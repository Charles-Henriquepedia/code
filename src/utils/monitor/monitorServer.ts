/**
 * Lightweight HTTP + WebSocket server for the session monitor.
 *
 * Serves the shared sessions.json as a REST API, streams live updates via
 * WebSocket, and auto-publishes to Tailscale when available.
 *
 * PTY relay provides bidirectional terminal I/O via WebSocket.
 *
 * Zero external dependencies beyond ws and qrcode (both in package.json).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import { networkInterfaces } from 'os'
import { randomUUID } from 'crypto'
import { toString as qrToString } from 'qrcode'
import type { AddressInfo } from 'net'
import { writeFileSync, existsSync } from 'fs'
import { readMonitorState, getMonitorDir, upsertSession, loadTabCache, saveTabCache, type TabCacheEntry } from './monitorStateFile.js'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { registerCleanup } from '../cleanupRegistry.js'
import { logForDebugging } from '../debug.js'
import { getPlatform } from '../platform.js'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { ptyRelay } from './ptyRelay.js'

// Module-level WS connections set for stdout streaming broadcast
const _wsConns: Set<WebSocket> = new Set()
const _litConnections: Set<WebSocket> = new Set()

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorServer = {
  stop: () => Promise<void>
  url: string
  urls: string[]
  port: number
}

export type ServerOptions = {
  port?: number
  public?: boolean
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PORT = 8765
let _currentPort = DEFAULT_PORT
function getCurrentPort() { return _currentPort }
const TS_PUBLISH_RETRIES = 3
const TS_RETRY_DELAY_MS = 500

// ---------------------------------------------------------------------------
// Server state
// ---------------------------------------------------------------------------

let _permissionMode = 'default'
let _modelSetting = 'claude-sonnet-4'

// Activity feed: tracks session state changes and broadcasts to SSE clients.
type ActivityEvent = {
  type: 'state-change' | 'session-start' | 'session-stop'
  sessionId: string
  from: string
  to: string
  timestamp: number
  sessionName?: string
}
const _activityFeed: ActivityEvent[] = []
const _activityClients: Set<ServerResponse> = new Set()
const _lastSessionStates: Record<string, string> = {}
const MAX_ACTIVITY_EVENTS = 100

// ---------------------------------------------------------------------------
// Token authentication
// ---------------------------------------------------------------------------

const TOKEN_DIR = join(getClaudeConfigHomeDir(), 'monitor')
const TOKEN_FILE = join(TOKEN_DIR, 'server.token')
const TOKEN_SKIP = process.env.MONITOR_TOKEN_SKIP === 'true'
let _authToken: string | null = null

/**
 * Load existing token from disk, or generate a new UUID and persist it.
 * Returns the token to use for the current server lifetime.
 */
async function loadOrCreateToken(): Promise<string> {
  if (TOKEN_SKIP) return 'skip'
  try {
    if (existsSync(TOKEN_FILE)) {
      const existing = (await readFile(TOKEN_FILE, 'utf-8')).trim()
      if (existing) return existing
    }
  } catch { /* fall through to generate */ }
  const token = randomUUID()
  try {
    await mkdir(TOKEN_DIR, { recursive: true })
    await writeFile(TOKEN_FILE, token, { mode: 0o600 })
  } catch { /* best-effort persistence */ }
  return token
}

/**
 * Validate the token from an HTTP request. Accepts:
 *   - Query param: ?token=xxx
 *   - Header: Authorization: Bearer xxx
 * Returns true if token matches (or skip mode is on).
 */
function validateHttpRequest(req: IncomingMessage): boolean {
  if (TOKEN_SKIP || !_authToken) return true
  const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
  const queryToken = url.searchParams.get('token')
  if (queryToken && queryToken === _authToken) return true
  const auth = req.headers.authorization
  if (auth && auth.startsWith('Bearer ')) {
    const bearer = auth.slice(7).trim()
    if (bearer === _authToken) return true
  }
  return false
}

/**
 * Validate the token from a WebSocket connection. Accepts:
 *   - Query param in upgrade URL: ?token=xxx
 *   - First message frame as JSON: {type:"auth", token:"..."}
 * Returns true if token matches (or skip mode is on).
 * If only query token is provided, validates immediately. If not, the caller
 * must wait for the first message frame and call validateWsMessage.
 */
function validateWsUpgrade(req: IncomingMessage): boolean {
  if (TOKEN_SKIP || !_authToken) return true
  if (!_authToken) return true
  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const queryToken = url.searchParams.get('token')
    if (queryToken && queryToken === _authToken) return true
    // Check Authorization header too
    const auth = req.headers.authorization
    if (auth && auth === 'Bearer ' + _authToken) return true
    return false
  } catch {
    return false
  }
}

/**
 * Send a message to a WebSocket client, translating for Lit frontend if needed.
 */
function sendToClient(ws: WebSocket, msg: string) {
  if (ws.readyState !== ws.OPEN) return
  if (_litConnections.has(ws)) {
    try {
      const data = JSON.parse(msg)
      if (data.type === 'update') {
        const sessions = data.sessions || []
        for (const s of sessions) {
          ws.send(JSON.stringify({ type: 'session_state', sessionId: s.sessionId, state: s.status }))
        }
        return
      }
      if (data.type === 'terminal-stream') {
        ws.send(JSON.stringify({ type: 'stream_event', sessionId: data.sessionId, event: { type: 'output', data: data.data } }))
        return
      }
      if (data.type === 'transcript-delta') {
        for (const entry of (data.entries || [])) {
          ws.send(JSON.stringify({ type: 'transcript_append', sessionId: data.sessionId, entry }))
        }
        return
      }
    } catch { /* fall through to raw send */ }
  }
  ws.send(msg)
}

// ---------------------------------------------------------------------------
// Detect network addresses
// ---------------------------------------------------------------------------

export function detectLocalIPs(): string[] {
  const ips: string[] = []
  const ifaces = networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.push(iface.address)
      }
    }
  }
  return ips
}

export async function detectTailscaleIP(): Promise<string | null> {
  let ip = await tryTailscale('tailscale')
  if (ip) return ip
  for (const ps of ['powershell.exe', '/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe']) {
    try {
      const { stdout } = await execFileNoThrow(ps, [
        '-NoProfile', '-Command',
        'tailscale ip -4',
      ], { timeout: 8000 })
      ip = stdout?.trim()
      if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip
    } catch { }
  }
  return null
}

async function tryTailscale(bin: string): Promise<string | null> {
  try {
    const { stdout } = await execFileNoThrow(bin, ['ip', '-4'], { timeout: 5000 })
    const ip = stdout?.trim()
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip
  } catch { }
  return null
}

async function detectTailscaleHostname(): Promise<string | null> {
  try {
    const { stdout } = await execFileNoThrow('tailscale', ['status', '--self', '--json'], { timeout: 5000 })
    if (!stdout) return null
    const data = JSON.parse(stdout) as { Self?: { DNSName?: string } }
    const dns = data?.Self?.DNSName
    if (dns) return dns.replace(/\.$/, '')
  } catch { }
  return null
}

function tailscaleIsInstalled(): boolean {
  try {
    const { execFileSync } = require('child_process')
    execFileSync('tailscale', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    try {
      const { execFileSync } = require('child_process')
      execFileSync('powershell.exe', ['-NoProfile', '-Command', 'tailscale version'], { stdio: 'ignore', timeout: 5000 })
      return true
    } catch { return false }
  }
}

async function tailscalePublish(port: number, isPublic: boolean, serveTarget?: string): Promise<{ url: string } | null> {
  const mode = isPublic ? 'funnel' : 'serve'
  const target = serveTarget ?? `http://127.0.0.1:${port}`
  const runners = [
    { bin: 'tailscale', args: [mode, '--bg', '--yes', `--https=443`, target] },
    { bin: 'powershell.exe', args: ['-NoProfile', '-Command', `tailscale ${mode} --bg --yes --https=443 ${target}`] },
  ]
  for (let attempt = 0; attempt < TS_PUBLISH_RETRIES; attempt++) {
    for (const runner of runners) {
      try {
        const { code } = await execFileNoThrow(runner.bin, runner.args, { timeout: 15000 })
        if (code === 0) {
          const host = await detectTailscaleHostname()
          const url = host ? `https://${host}` : `https://${await detectTailscaleIP() ?? 'localhost'}`
          return { url }
        }
      } catch { }
    }
    if (attempt < TS_PUBLISH_RETRIES - 1) {
      await new Promise(r => setTimeout(r, TS_RETRY_DELAY_MS))
    }
  }
  return null
}

async function tailscaleUnpublish(): Promise<void> {
  for (const cmd of [
    { bin: 'tailscale', args: ['serve', '--https=443', 'off'] },
    { bin: 'tailscale', args: ['funnel', '--https=443', 'off'] },
    { bin: 'powershell.exe', args: ['-NoProfile', '-Command', 'tailscale serve --https=443 off'] },
    { bin: 'powershell.exe', args: ['-NoProfile', '-Command', 'tailscale funnel --https=443 off'] },
  ]) {
    try { await execFileNoThrow(cmd.bin, cmd.args, { timeout: 10000 }) } catch { }
  }
}

// ---------------------------------------------------------------------------
// Mobile HTML — complete polished SPA
// ---------------------------------------------------------------------------

// Module-level: the bundler extracts htmlShell to module scope, and the
// template concatenates tokSuffix into WS URLs. Must be accessible here.
let tokSuffix = ''

function renderMobileHTML(wsUrl: string, token: string): string {
  const tokQs = token && token !== 'skip' ? `?token=${encodeURIComponent(token)}` : ''
  tokSuffix = token && token !== 'skip' ? tokQs : ''
  // Inject tokSuffix/WS URL/port into template placeholders
  const html = htmlShell
    .replaceAll('"ws://localhost:18765/ws"', `"${wsUrl}${tokSuffix}"`)
    .replaceAll('"ws://localhost:18765"', `"${wsUrl}${tokSuffix}"`)
    .replaceAll('ws://localhost:18765', `${wsUrl}${tokSuffix}`)
    .replaceAll('?token=0708a93a-d25b-4df0-ad4b-94a7e27e8b7b', tokSuffix)
    .replaceAll('http://localhost:18765', wsUrl.replace(/^ws/, 'http'))
    .replaceAll('18765', String(getCurrentPort()))
  const css = htmlStyles.replaceAll('18765', String(getCurrentPort()))
  return css + html
}

import { htmlStyles, htmlShell } from './web/template.js'

function killProcess(pid: number): boolean {
  try {
    const plat = getPlatform()
    if (plat === 'windows') {
      process.kill(pid) // Windows: no signal name
    } else {
      process.kill(pid, 'SIGTERM')
    }
    return true
  } catch {
    return false
  }
}

/**
 * Discover the daemon API port.
 * Priority: config.json > daemon.log (last "listening on http://...:PORT") > default 8765.
 * Returns null if no daemon detected.
 */
async function getDaemonPort(): Promise<number | null> {
  const { readFile } = await import('fs/promises')
  const home = process.env.HOME || '/home'
  const daemonDir = join(home, '.verboo', 'daemon')

  // 1. Try config.json
  try {
    const configData = await readFile(join(daemonDir, 'config.json'), 'utf-8')
    const config = JSON.parse(configData) as { port?: number }
    if (config.port) return config.port
  } catch { /* no config */ }

  // 2. Parse daemon.log for last "listening on http://HOST:PORT"
  try {
    const logData = await readFile(join(daemonDir, 'daemon.log'), 'utf-8')
    const matches = logData.match(/listening on http:\/\/[^\s]+:(\d+)/g)
    if (matches && matches.length > 0) {
      const lastMatch = matches[matches.length - 1]
      const portMatch = lastMatch.match(/:(\d+)$/)
      if (portMatch) return parseInt(portMatch[1], 10)
    }
  } catch { /* no log */ }

  // 3. Default port (but check if it's the monitor server itself)
  return 8765
}

/**
 * Check if a daemon is actually listening on the given port.
 */
async function isDaemonAlive(port: number): Promise<boolean> {
  try {
    const resp = await fetch(`http://127.0.0.1:${port}/api/v1/health`, { signal: AbortSignal.timeout(1000) })
    return resp.ok
  } catch {
    return false
  }
}

/**
 * Serve the models list for /api/models and /api/v1/models.
 * Tries daemon API first, then Verboo API, then hardcoded fallback.
 */
async function serveModels(res: ServerResponse): Promise<void> {
  // 1. Try daemon API
  const daemonPort = await getDaemonPort()
  if (daemonPort) {
    try {
      const resp = await fetch(`http://127.0.0.1:${daemonPort}/api/v1/models`, { signal: AbortSignal.timeout(2000) })
      if (resp.ok) {
        const body = await resp.json() as { models?: Array<{ id: string; name?: string }> }
        if (body.models && body.models.length > 0) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ models: body.models }))
          return
        }
      }
    } catch { /* daemon not available */ }
  }

  // 2. Try Verboo API directly
  try {
    const home = process.env.HOME || '/home'
    const credPath = join(home, '.verboo', '.credentials.json')
    const { readFile } = await import('fs/promises')
    const credData = await readFile(credPath, 'utf-8')
    const parsed = JSON.parse(credData) as { verbooOauth?: { accessToken?: string } }
    const token = parsed.verbooOauth?.accessToken
    if (token) {
      const resp = await fetch('https://code.verboo.ai/router/v1/models', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      })
      if (resp.ok) {
        const body = await resp.json() as { data?: Array<Record<string, unknown>> }
        if (body.data && body.data.length > 0) {
          const models = body.data.map((m: Record<string, unknown>) => ({
            id: (m.id ?? m.name ?? '') as string,
            name: (m.display_name ?? m.displayName ?? m.id ?? m.name ?? '') as string,
          })).filter((m: { id: string }) => m.id)
          if (models.length > 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ models }))
            return
          }
        }
      }
    }
  } catch { /* Verboo API not available */ }

  // 3. Hardcoded fallback
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify({
    models: [
      { id: 'ultra/glm-5.2', name: 'GLM 5.2 Ultra' },
      { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6' },
      { id: 'claude-haiku-4-5', name: 'Claude Haiku 4.5' },
    ],
  }))
}

/** Write text to a terminal session.
 *
 * Priority:
 *   1. IPC Unix socket — injects DIRECTLY into process.stdin via unshift().
 *      This is the primary mechanism: monitor hooks run inside the Verboo
 *      process and create a socket at ~/.verboo/monitor/{sessionId}.sock.
 *      No tmux/screen/TIOCSTI needed. Works with `bun run start`.
 *   2. tmux send-keys — fallback if inside tmux and socket unavailable
 *   3. screen -X stuff — fallback if inside screen
 *   4. Raw TTY write — last resort, visual only (does NOT inject as stdin)
 */
/**
 * Capture a snapshot of the terminal screen for a session.
 *
 * Strategy:
 *   1. If the session is in a tmux session, use `tmux capture-pane` to grab
 *      the visible content (most reliable).
 *   2. Otherwise, on Linux, try `script -q -c "tput sc" /dev/null` style
 *      snapshot — but this is unreliable without a PTY recorder.
 *   3. Fall back to returning the last known terminal-stream buffer if the
 *      server has one cached for this session.
 *
 * Returns a text snapshot of the terminal screen.
 */
async function captureTerminalSnapshot(session: { tty?: string; tmuxSession?: string; sessionId: string }): Promise<string> {
  // Strategy 1: tmux capture-pane (most reliable for tmux sessions)
  if (session.tmuxSession) {
    try {
      const result = await execFileNoThrow('tmux', [
        'capture-pane',
        '-t', session.tmuxSession,
        '-p', // print to stdout
        '-S', '-', // start from the top of the visible pane
      ], { timeout: 3000 })
      if (result.stdout && result.stdout.trim()) return result.stdout
    } catch { /* fall through */ }
  }

  // Strategy 2: On Linux, try to read the TTY's current content via
  // /dev/vcsa or similar. This is best-effort and may not work.
  if (session.tty && process.platform === 'linux') {
    try {
      // Try reading the TTY directly — this may return the current screen
      // content if the TTY is in raw mode and has been recently written to.
      const content = await readFile(session.tty, 'utf-8').catch(() => '')
      if (content && content.trim()) return content
    } catch { /* fall through */ }
  }

  // Strategy 3: Fall back to a placeholder message
  return `[Screen capture not available for session ${session.sessionId}]\n` +
    `TTY: ${session.tty ?? 'unknown'}\n` +
    `tmux: ${session.tmuxSession ?? 'none'}\n` +
    `\nTo enable screen capture, run the session inside tmux:\n` +
    `  tmux new-session -s <name> 'verboo'`
}

/**
 * Compute token usage and cost for a session by reading the transcript.
 *
 * Aggregates input_tokens, output_tokens, cache_creation_input_tokens,
 * and cache_read_input_tokens from all assistant entries in the transcript.
 * Estimates cost using approximate per-token rates.
 */
async function computeSessionUsage(sessionId: string): Promise<{
  inputTokens: number
  outputTokens: number
  cacheCreationTokens: number
  cacheReadTokens: number
  totalTokens: number
  estimatedCostUsd: number
  entryCount: number
}> {
  const entries = await readFullTranscript(sessionId)
  let inputTokens = 0
  let outputTokens = 0
  let cacheCreationTokens = 0
  let cacheReadTokens = 0
  let entryCount = 0
  for (const e of entries) {
    if (e.type !== 'assistant') continue
    // The transcript entry doesn't expose usage directly in our parsed shape,
    // so we re-read the raw line to extract the usage block.
    // readFullTranscript already parsed the line; we approximate by counting
    // text length as a fallback if usage is missing.
    entryCount++
  }
  // Re-parse the raw transcript to extract usage blocks from assistant entries.
  try {
    const path = await findTranscriptPath(sessionId)
    if (path) {
      const content = await readFile(path, 'utf-8')
      for (const line of content.split('\n')) {
        if (!line.trim()) continue
        try {
          const entry = JSON.parse(line)
          if (entry.type === 'assistant' && entry.message?.usage) {
            const u = entry.message.usage
            inputTokens += u.input_tokens ?? 0
            outputTokens += u.output_tokens ?? 0
            cacheCreationTokens += u.cache_creation_input_tokens ?? 0
            cacheReadTokens += u.cache_read_input_tokens ?? 0
          }
        } catch { /* skip invalid lines */ }
      }
    }
  } catch { /* best-effort */ }
  const totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens
  // Approximate cost rates (USD per 1M tokens) — Claude Sonnet 4 pricing.
  // These are estimates; real cost depends on the model used.
  const COST_PER_M_INPUT = 3.0
  const COST_PER_M_OUTPUT = 15.0
  const COST_PER_M_CACHE_WRITE = 3.75
  const COST_PER_M_CACHE_READ = 0.30
  const estimatedCostUsd =
    (inputTokens * COST_PER_M_INPUT + outputTokens * COST_PER_M_OUTPUT +
     cacheCreationTokens * COST_PER_M_CACHE_WRITE + cacheReadTokens * COST_PER_M_CACHE_READ) / 1_000_000
  return {
    inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens,
    totalTokens, estimatedCostUsd, entryCount,
  }
}

function injectInput(
  ttyPath: string,
  text: string,
  sessionId?: string,
  tmuxSession?: string,
): boolean {
  try {
    const plat = getPlatform()
    if (plat === 'windows') return false

    // 1. IPC socket — primary mechanism, works in all non-tmux environments
    if (sessionId) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { createConnection } = require('net')
        const { join } = require('path')
        const socketPath = join(getMonitorDir(), `${sessionId}.sock`)
        const client = createConnection(socketPath)
        client.write(text, 'utf8')
        client.end()
        client.on('error', () => { /* socket not available */ })
        return true
      } catch {
        // Socket doesn't exist — process may not have started hooks yet.
        // Fall through to other methods.
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process')

    // 2. tmux send-keys
    if (tmuxSession) {
      try {
        const escaped = "'" + text.replace(/'/g, "'\\''") + "'"
        execSync(`tmux send-keys -t "${tmuxSession}" ${escaped}`, {
          stdio: 'ignore',
          timeout: 5000,
        })
        return true
      } catch { /* tmux not available */ }
    }

    // 3. screen stuff
    try {
      const sty = process.env.STY
      if (sty) {
        const escaped = text.replace(/'/g, "'\\''")
        execSync(`screen -S "${sty}" -X stuff '${escaped}\r'`, {
          stdio: 'ignore',
          timeout: 5000,
        })
        return true
      }
    } catch { /* screen not available */ }

    // 4. Raw TTY write — visual only, does NOT inject as stdin
    writeFileSync(ttyPath, text)
    return true
  } catch {
    return false
  }
}

const _KILLED = new Set<number>()

// ---------------------------------------------------------------------------
// Transcript reader
// ---------------------------------------------------------------------------

/**
 * Resolve the transcript file path for a session.
 *
 * Priority:
 *   1. session.transcriptPath from the state file (most reliable — set by
 *      the Verboo process itself using getSessionProjectDir() + getSessionId())
 *   2. Fallback: search ~/.claude/projects/ and ~/.verboo/projects/ for
 *      {sessionId}.jsonl (backward compat for older state files)
 */
async function findTranscriptPath(sessionId: string): Promise<string | null> {
  // 1. Check state file for transcriptPath
  try {
    const state = await readMonitorState()
    const session = state.sessions[sessionId]
    if (session?.transcriptPath) {
      try {
        const { stat } = await import('fs/promises')
        await stat(session.transcriptPath)
        return session.transcriptPath
      } catch { /* file gone — fall through to search */ }
    }
  } catch { /* state read failed */ }

  // 2. Fallback: search project dirs by sessionId
  const { homedir } = await import('os')
  const home = homedir()
  for (const base of ['.claude', '.verboo']) {
    try {
      const projDir = join(home, base, 'projects')
      const { readdir } = await import('fs/promises')
      const dirs2 = await readdir(projDir)
      for (const d of dirs2) {
        const candidate = join(projDir, d, `${sessionId}.jsonl`)
        try {
          const { stat } = await import('fs/promises')
          await stat(candidate)
          return candidate
        } catch { /* not in this subdir */ }
      }
    } catch { /* base not found */ }
  }

  // 3. Fallback: find the most recently modified .jsonl in the project dir
  //    matching the session's cwd. This handles the case where Verboo generates
  //    a new sessionId on startup but the transcript JSONL keeps the inherited
  //    sessionId from --resume.
  try {
    const state = await readMonitorState()
    const session = state.sessions[sessionId]
    if (session?.cwd) {
      const projectDirName = session.cwd.replace(/[^a-zA-Z0-9._-]/g, '-')
      for (const base of ['.claude', '.verboo']) {
        try {
          const projDir = join(home, base, 'projects', projectDirName)
          const { readdir, stat } = await import('fs/promises')
          const files = await readdir(projDir)
          let newest: { path: string; mtime: number } | null = null
          for (const f of files) {
            if (!f.endsWith('.jsonl')) continue
            const full = join(projDir, f)
            try {
              const s = await stat(full)
              if (!newest || s.mtimeMs > newest.mtime) {
                newest = { path: full, mtime: s.mtimeMs }
              }
            } catch { /* skip */ }
          }
          if (newest) {
            logForDebugging(`[Monitor] findTranscriptPath: using newest JSONL ${newest.path} (sessionId ${sessionId} mismatch)`, { level: 'debug' })
            return newest.path
          }
        } catch { /* projDir not found */ }
      }
    }
  } catch { /* state read failed */ }

  return null
}

/**
 * Read a transcript JSONL file and return chat messages (user + assistant).
 * Backward-compat: chat-only view (text bubbles).
 */
async function readTranscript(sessionId: string): Promise<{ role: string; text: string; timestamp: string; model?: string }[]> {
  const full = await readFullTranscript(sessionId)
  const out: { role: string; text: string; timestamp: string; model?: string }[] = []
  for (const e of full) {
    if (e.type === 'user' && e.text) {
      out.push({ role: 'user', text: e.text, timestamp: e.timestamp, model: e.model })
    } else if (e.type === 'assistant' && e.text) {
      out.push({ role: 'assistant', text: e.text, timestamp: e.timestamp, model: e.model })
    }
  }
  return out
}

/**
 * Parse a single JSONL line into a FullTranscriptEntry (or null if invalid).
 */
function parseTranscriptLine(line: string): FullTranscriptEntry | null {
  if (!line) return null
  try {
    const entry = JSON.parse(line)
    const t = entry.type ?? 'unknown'
    const ts: string = entry.timestamp ?? ''
    const uuid: string | undefined = entry.uuid
    const parentUuid: string | null | undefined = entry.parentUuid

    if (t === 'user') {
      const content = entry.message?.content
      if (typeof content === 'string') {
        return { type: 'user', role: 'user', text: content, timestamp: ts, uuid, parentUuid, model: entry.message?.model }
      }
      if (Array.isArray(content)) {
        // If the array has tool_result blocks, return as a single user entry with toolResult.
        // If it has text blocks, return as a single user entry with text.
        for (const b of content) {
          if (b?.type === 'tool_result') {
            let resultText = ''
            if (typeof b.content === 'string') resultText = b.content
            else if (Array.isArray(b.content)) {
              resultText = b.content
                .map((x: any) => (x?.type === 'text' ? String(x.text ?? '') : ''))
                .filter(Boolean)
                .join('\n')
            }
            return {
              type: 'user',
              role: 'user',
              timestamp: ts,
              uuid,
              parentUuid,
              toolResult: { toolUseId: b.tool_use_id, content: resultText, isError: !!b.is_error },
            }
          }
        }
        for (const b of content) {
          if (b?.type === 'text') {
            return { type: 'user', role: 'user', text: String(b.text ?? ''), timestamp: ts, uuid, parentUuid }
          }
        }
        return null
      }
      return null
    }

    if (t === 'assistant') {
      const blocks = entry.message?.content
      const model: string | undefined = entry.message?.model
      const outBlocks: FullTranscriptEntry['blocks'] = []
      let textOnly = ''
      if (Array.isArray(blocks)) {
        for (const b of blocks) {
          if (b?.type === 'text') {
            outBlocks.push({ kind: 'text', text: String(b.text ?? '') })
            textOnly += (textOnly ? '\n' : '') + String(b.text ?? '')
          } else if (b?.type === 'tool_use') {
            outBlocks.push({ kind: 'tool_use', toolName: b.name, toolUseId: b.id, toolInput: b.input })
          } else if (b?.type === 'thinking') {
            outBlocks.push({ kind: 'thinking', thinking: String(b.thinking ?? '') })
          } else if (b?.type === 'redacted_thinking') {
            outBlocks.push({ kind: 'redacted_thinking' })
          } else {
            outBlocks.push({ kind: 'unknown' })
          }
        }
      }
      return {
        type: 'assistant',
        role: 'assistant',
        text: textOnly || undefined,
        timestamp: ts,
        model,
        uuid,
        parentUuid,
        blocks: outBlocks,
      }
    }

    if (t === 'system') {
      return {
        type: 'system',
        subtype: entry.subtype,
        level: entry.level,
        timestamp: ts,
        uuid,
        parentUuid,
        raw: { hookCount: entry.hookCount, stopReason: entry.stopReason, hasOutput: entry.hasOutput },
      }
    }
    if (t === 'summary') {
      return { type: 'summary', text: entry.summary, timestamp: ts, uuid, parentUuid }
    }
    if (t === 'mode' || t === 'file-history-snapshot' || t === 'last-prompt') {
      return { type: t, timestamp: ts, raw: entry }
    }
    return { type: 'unknown', timestamp: ts, raw: entry }
  } catch {
    return null
  }
}

/**
 * Read transcript entries since a byte offset. Returns entries + new offset.
 * Used by the live-stream WebSocket handler to push only new lines.
 */
async function readTranscriptSince(
  path: string,
  offset: number,
): Promise<{ entries: FullTranscriptEntry[]; offset: number }> {
  let fd: number | undefined
  try {
    const { open } = await import('fs/promises')
    fd = await open(path, 'r')
    const stat = await fd.stat()
    if (stat.size < offset) {
      // File was truncated/rotated — start from 0
      offset = 0
    }
    const len = stat.size - offset
    if (len <= 0) {
      await fd.close()
      return { entries: [], offset }
    }
    const buf = Buffer.alloc(len)
    await fd.read(buf, 0, len, offset)
    await fd.close()
    const text = buf.toString('utf8')
    const lines = text.split('\n')
    // If the file doesn't end with \n, the last line is partial — drop it and rewind offset.
    let newOffset = offset + len
    if (!text.endsWith('\n') && lines.length > 0) {
      const partial = lines[lines.length - 1]
      newOffset = offset + len - Buffer.byteLength(partial, 'utf8')
      lines.pop()
    }
    const entries: FullTranscriptEntry[] = []
    for (const line of lines) {
      const e = parseTranscriptLine(line)
      if (e) entries.push(e)
    }
    return { entries, offset: newOffset }
  } catch {
    if (fd) try { await fd.close() } catch { }
    return { entries: [], offset }
  }
}

type FullTranscriptEntry = {
  type: 'user' | 'assistant' | 'system' | 'summary' | 'mode' | 'file-history-snapshot' | 'last-prompt' | 'unknown'
  subtype?: string
  role?: string
  text?: string
  timestamp: string
  model?: string
  uuid?: string
  parentUuid?: string | null
  // assistant blocks
  blocks?: Array<{
    kind: 'text' | 'tool_use' | 'thinking' | 'redacted_thinking' | 'unknown'
    text?: string
    toolName?: string
    toolUseId?: string
    toolInput?: unknown
    thinking?: string
  }>
  // user tool_result
  toolResult?: {
    toolUseId?: string
    content: string
    isError: boolean
  }
  // system
  level?: string
  raw?: unknown
}

/**
 * Read a transcript JSONL file and return ALL entry types in order:
 * user (string or array content with tool_result), assistant (text/tool_use/thinking),
 * system, summary, mode, file-history-snapshot, last-prompt.
 */
async function readFullTranscript(sessionId: string): Promise<FullTranscriptEntry[]> {
  const path = await findTranscriptPath(sessionId)
  if (!path) return []
  const raw = await readFile(path, 'utf8')
  const lines = raw.split('\n').filter(Boolean)
  const entries: FullTranscriptEntry[] = []

  for (const line of lines) {
    try {
      const entry = JSON.parse(line)
      const t = entry.type ?? 'unknown'

      if (t === 'user') {
        const content = entry.message?.content
        const ts: string = entry.timestamp ?? ''
        const uuid: string | undefined = entry.uuid
        const parentUuid: string | null | undefined = entry.parentUuid
        if (typeof content === 'string') {
          entries.push({ type: 'user', role: 'user', text: content, timestamp: ts, uuid, parentUuid, model: entry.message?.model })
        } else if (Array.isArray(content)) {
          for (const b of content) {
            if (b?.type === 'tool_result') {
              let resultText = ''
              if (typeof b.content === 'string') resultText = b.content
              else if (Array.isArray(b.content)) {
                resultText = b.content
                  .map((x: any) => (x?.type === 'text' ? String(x.text ?? '') : ''))
                  .filter(Boolean).join('\n')
              }
              entries.push({ type: 'user', role: 'user', timestamp: ts, uuid, parentUuid, toolResult: { toolUseId: b.tool_use_id, content: resultText, isError: !!b.is_error } })
            } else if (b?.type === 'text') {
              entries.push({ type: 'user', role: 'user', text: String(b.text ?? ''), timestamp: ts, uuid, parentUuid })
            }
          }
        }
      } else if (t === 'assistant') {
        const parsed = parseTranscriptLine(line)
        if (parsed) entries.push(parsed)
      } else if (t === 'system') {
        const parsed = parseTranscriptLine(line)
        if (parsed) entries.push(parsed)
      } else if (t === 'summary') {
        const parsed = parseTranscriptLine(line)
        if (parsed) entries.push(parsed)
      } else {
        const parsed = parseTranscriptLine(line)
        if (parsed) entries.push(parsed)
      }
    } catch { /* skip */ }
  }
  return entries
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Live transcript streaming via fs.watch
// ---------------------------------------------------------------------------

type TranscriptSubscription = {
  sessionId: string
  path: string
  offset: number
  watcher: { close: () => void } | null
  pollTimer: NodeJS.Timeout | null
}

const _transcriptSubs = new Map<WebSocket, TranscriptSubscription>()

async function handleSubscribeTranscript(ws: WebSocket, sessionId: string): Promise<void> {
  // Clean up any existing sub for this ws
  handleUnsubscribeTranscript(ws)

  const path = await findTranscriptPath(sessionId)
  if (!path) {
    logForDebugging(`[Monitor] subscribe-transcript: path not found for ${sessionId}`, { level: 'warn' })
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: 'transcript-error', sessionId, error: 'Transcript not found' }))
    }
    return
  }

  // Start from end of file — only push NEW lines from now on.
  let offset = 0
  try {
    const { stat } = await import('fs/promises')
    const s = await stat(path)
    offset = s.size
  } catch { /* file may not exist yet */ }

  const sub: TranscriptSubscription = {
    sessionId,
    path,
    offset,
    watcher: null,
    pollTimer: null,
  }
  _transcriptSubs.set(ws, sub)
  logForDebugging(`[Monitor] subscribe-transcript: ${sessionId} → ${path} (offset=${offset})`, { level: 'debug' })

  // Push helper — reads new bytes, sends deltas, updates offset
  const pushDelta = async () => {
    const result = await readTranscriptSince(sub.path, sub.offset)
    sub.offset = result.offset
    if (result.entries.length > 0 && ws.readyState === ws.OPEN) {
      sendToClient(ws, JSON.stringify({
        type: 'transcript-delta',
        sessionId: sub.sessionId,
        entries: result.entries,
      }))
    }
  }

  // fs.watch for live updates (sub-second latency on most platforms)
  let watchFired = false
  try {
    const fs = await import('fs')
    const watcher = fs.watch(path, async () => {
      if (!watchFired) {
        watchFired = true
        logForDebugging(`[Monitor] fs.watch fired for ${sub.path}`, { level: 'debug' })
      }
      await pushDelta()
    })
    sub.watcher = watcher
    watcher.on('error', (err: unknown) => {
      logForDebugging(`[Monitor] fs.watch error: ${(err as Error)?.message}`, { level: 'warn' })
    })
  } catch (err: unknown) {
    logForDebugging(`[Monitor] fs.watch unavailable, polling only: ${(err as Error)?.message}`, { level: 'debug' })
  }

  // Polling fallback (every 1s) — covers WSL/network drives where fs.watch is unreliable.
  // Also catches rotation/truncation (readTranscriptSince handles offset > size).
  sub.pollTimer = setInterval(pushDelta, 1000)
}

function handleUnsubscribeTranscript(ws: WebSocket): void {
  const sub = _transcriptSubs.get(ws)
  if (!sub) return
  try { sub.watcher?.close() } catch { }
  if (sub.pollTimer) clearInterval(sub.pollTimer)
  _transcriptSubs.delete(ws)
}

// Map of sessionId → open IPC socket connection for stdout streaming
const _streamConns = new Map<string, { socket: import('net').Socket; timer: NodeJS.Timeout }>()

/**
 * Connect to all active sessions' IPC sockets to receive stdout streaming.
 * Polls every 5s for new/expired sessions.
 */
function connectToSessions(): void {
  const poll = async () => {
    try {
      const state = await readMonitorState()
      for (const [sid] of Object.entries(state.sessions)) {
        if (_streamConns.has(sid)) continue
        const socketPath = join(getMonitorDir(), `${sid}.sock`)
        // lazy connect via net.createConnection
        const socket = require('net').createConnection(socketPath, () => {
          // Connected — now listen for stdout chunks
          socket.on('data', (data: Buffer) => {
            // Broadcast to all WS clients watching this session
            const msg = JSON.stringify({
              type: 'terminal-stream',
              sessionId: sid,
              data: data.toString('utf8'),
            })
            for (const ws of _wsConns) {
              try { sendToClient(ws, msg) } catch { /* ignore */ }
            }
          })
          socket.on('error', () => { _streamConns.delete(sid) })
          socket.on('close', () => { _streamConns.delete(sid) })
        })
        socket.on('error', () => { /* session not ready yet */ })
        const timer = setTimeout(() => { socket.destroy(); _streamConns.delete(sid) }, 60000)
        _streamConns.set(sid, { socket, timer })
      }
      // Clean up stale connections
      for (const [sid, conn] of _streamConns) {
        if (!state.sessions[sid]) {
          clearTimeout(conn.timer)
          conn.socket.destroy()
          _streamConns.delete(sid)
        }
      }
    } catch { /* polling error */ }
  }
  poll()
  setInterval(poll, 5000)
}

export async function startMonitorServer(
  options: ServerOptions = {},
): Promise<MonitorServer> {
  const port = options.port ?? DEFAULT_PORT
  _currentPort = port
  const isPublic = options.public ?? false

  // Generate or load the auth token for this server instance.
  _authToken = await loadOrCreateToken()
  if (!TOKEN_SKIP && _authToken !== 'skip') {
    console.log(`Access token: ${_authToken}`)
    console.log(`Token file: ${TOKEN_FILE}`)
  } else if (TOKEN_SKIP) {
    console.log('Token authentication SKIPPED (MONITOR_TOKEN_SKIP=true)')
  }

  const tsIP = await detectTailscaleIP()
  const tsHostname = tsIP ? await detectTailscaleHostname() : null
  const localIPs = detectLocalIPs()
  const urls: string[] = []

  if (tsIP) urls.push(`http://${tsIP}:${port}`)
  if (tsHostname) urls.push(`https://${tsHostname}`)
  for (const ip of localIPs) {
    if (ip !== tsIP) urls.push(`http://${ip}:${port}`)
  }
  urls.push(`http://localhost:${port}`)
  const primaryUrl = urls[0] ?? `http://localhost:${port}`

  let connections: Set<WebSocket> = new Set()
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const path = url.pathname

    // /ws is handled by WebSocketServer via 'upgrade' event - don't handle here.
    // Returning 426 here would prevent WS upgrade from completing.
    // Check if this is a WS upgrade request and skip if so.
    if (path === '/ws' && req.headers.upgrade) { return }

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    // Token authentication — reject all requests without a valid token.
    // /health is exempt so monitoring probes can check uptime.
    if (path !== '/health' && !validateHttpRequest(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ ok: false, error: 'Invalid or missing token' }))
      return
    }

    // Normalize /api/v1/* → /api/* for Lit frontend compatibility
    const normalizedPath = path.startsWith('/api/v1/') ? path.replace('/api/v1/', '/api/') : path

    try {
      if (normalizedPath === '/' || path === '/' || path === '/index.html') {
        const wsUrl = `ws://${req.headers.host ?? `localhost:${port}`}/ws`
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderMobileHTML(wsUrl, _authToken ?? ''))
      } else if (normalizedPath === '/api/sessions' && req.method === 'GET') {
        const state = await readMonitorState()
        // Transform to Lit frontend format: { sessions: Session[] }
        const sessions = await Promise.all(Object.values(state.sessions).map(async s => {
          let model = s.model || 'unknown'
          // Try to get model from transcript
          if (model === 'unknown') {
            try {
              const path = await findTranscriptPath(s.sessionId)
              if (path) {
                const { open } = await import('fs/promises')
                const fileHandle = await open(path, 'r')
                // Only read first 2KB to find the model
                const buf = Buffer.alloc(2048)
                await fileHandle.read(buf, 0, 2048, 0)
                await fileHandle.close()
                const head = buf.toString('utf8')
                const line = head.split('\n').find((l: string) => l.includes('"model"'))
                if (line) {
                  try {
                    const entry = JSON.parse(line)
                    model = entry.message?.model || model
                  } catch { /* invalid line */ }
                }
              }
            } catch { /* best effort */ }
          }
          return {
            id: s.sessionId,
            title: s.name || s.sessionId.slice(0, 8),
            model,
            status: s.status,
            cwd: s.cwd,
            pid: s.pid,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          }
        }))
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ sessions }))
      } else if (normalizedPath === '/api/sessions' && req.method === 'POST') {
        // POST /api/v1/sessions — create new session
        const state = await readMonitorState()
        const sessions = Object.values(state.sessions)
        const latest = sessions.sort((a, b) => (b.updatedAt || b.createdAt) - (a.updatedAt || a.createdAt))[0]
        if (latest) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({
            session: {
              id: latest.sessionId,
              title: latest.name || latest.sessionId.slice(0, 8),
              model: latest.model || 'unknown',
              status: latest.status,
            },
          }))
        } else {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ error: 'No sessions found' }))
        }
      } else if (normalizedPath === '/api/sessions/stop' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { sessionId?: string }
            if (!data.sessionId) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Missing sessionId' }))
              return
            }
            readMonitorState().then(state => {
              const session = state.sessions[data.sessionId!]
              if (!session || !session.pid) {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
                return
              }
              try {
                killProcess(session.pid)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
              } catch (killErr: unknown) {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: (killErr as Error)?.message ?? 'Kill failed' }))
              }
            }).catch((err: unknown) => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Read state failed' }))
            })
          } catch (parseErr: unknown) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath === '/api/sessions/send' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { sessionId?: string; text?: string; submit?: boolean }
            if (!data.sessionId || !data.text) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Missing sessionId or text' }))
              return
            }
            readMonitorState().then(state => {
              const session = state.sessions[data.sessionId!]
              if (!session?.tty) {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Session not found or no TTY' }))
                return
              }
              const text = data.submit ? String(data.text) + '\r' : String(data.text)
              const ok = injectInput(session.tty, text, session.sessionId, session.tmuxSession)
              res.writeHead(ok ? 200 : 500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok }))
            }).catch((err: unknown) => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Read state failed' }))
            })
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath === '/api/activity' && req.method === 'GET') {
        // SSE stream for activity feed events.
        res.writeHead(200, {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
          'Access-Control-Allow-Origin': '*',
        })
        res.write('retry: 5000\n\n')
        // Send backlog of recent events first
        for (const ev of _activityFeed) {
          res.write(`data: ${JSON.stringify(ev)}\n\n`)
        }
        _activityClients.add(res)
        // Heartbeat every 30s to keep connection alive
        const heartbeat = setInterval(() => {
          try { res.write(': heartbeat\n\n') } catch { /* gone */ }
        }, 30000)
        req.on('close', () => {
          clearInterval(heartbeat)
          _activityClients.delete(res)
        })
      } else if (normalizedPath === '/api/sessions/rename' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { sessionId?: string; name?: string }
            if (!data.sessionId) {
              res.writeHead(400, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Missing sessionId' }))
              return
            }
            readMonitorState().then(state => {
              const session = state.sessions[data.sessionId!]
              if (!session) {
                res.writeHead(404, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
                return
              }
              // Persist the name by writing back the session file with the new name.
              upsertSession(session.sessionId, { ...session, name: data.name ?? '' }).then(() => {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: true }))
                broadcastUpdate()
              }).catch((err: unknown) => {
                res.writeHead(500, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Rename failed' }))
              })
            }).catch((err: unknown) => {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Read state failed' }))
            })
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath.startsWith('/api/sessions/') && !normalizedPath.includes('/capture') && !normalizedPath.includes('/usage') && !normalizedPath.includes('/full') && !normalizedPath.includes('/transcript') && req.method === 'GET') {
        // GET /api/v1/sessions/:id — return single session
        const sid = normalizedPath.split('/')[3]
        if (!sid) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Missing sessionId' }))
          return
        }
        const state = await readMonitorState()
        const session = state.sessions[sid]
        if (!session) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
          return
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          session: {
            id: session.sessionId,
            title: session.name || session.sessionId.slice(0, 8),
            model: session.model || 'unknown',
            status: session.status,
            cwd: session.cwd,
            pid: session.pid,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
          },
        }))
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/chat') && req.method === 'POST') {
        // POST /api/v1/sessions/:id/chat — proxy SSE stream from daemon
        const sid = normalizedPath.split('/')[3]
        let chatBody = ''
        req.on('data', (chunk: string) => { chatBody += chunk })
        req.on('end', async () => {
          const daemonPort = await getDaemonPort()
          if (!daemonPort) {
            res.writeHead(503, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Daemon not running. Start it with: verboo daemon start', code: 'NO_DAEMON' }))
            return
          }
          try {
            const upstream = await fetch(`http://127.0.0.1:${daemonPort}/api/v1/sessions/${sid}/chat`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: chatBody,
            })
            if (!upstream.ok || !upstream.body) {
              const text = await upstream.text().catch(() => '')
              res.writeHead(upstream.status || 502, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: text || `Daemon returned ${upstream.status}`, code: 'DAEMON_ERROR' }))
              return
            }
            // Stream SSE from daemon to client
            res.writeHead(200, {
              'Content-Type': 'text/event-stream',
              'Cache-Control': 'no-cache',
              'Connection': 'keep-alive',
              'X-Accel-Buffering': 'no',
            })
            const reader = upstream.body.getReader()
            const decoder = new TextDecoder()
            try {
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                res.write(decoder.decode(value, { stream: true }))
              }
            } catch (err) {
              res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`)
            }
            res.end()
          } catch (err) {
            res.writeHead(502, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: `Proxy failed: ${(err as Error).message}`, code: 'PROXY_ERROR' }))
          }
        })
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/model') && req.method === 'POST') {
        // POST /api/v1/sessions/:id/model — set model
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { model?: string }
            const sid = normalizedPath.split('/')[3]
            _modelSetting = data.model || _modelSetting
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, sessionId: sid, model: _modelSetting }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/interrupt') && req.method === 'POST') {
        // POST /api/v1/sessions/:id/interrupt — send Ctrl+C
        const sid = normalizedPath.split('/')[3]
        readMonitorState().then(state => {
          const session = state.sessions[sid!]
          if (session?.pid) {
            try { killProcess(session.pid) } catch { /* pid gone */ }
          }
          // Also send Ctrl+C to PTY if exists
          if (sid) ptyRelay.writeInput(sid, String.fromCharCode(3))
        }).catch(() => {})
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, sessionId: sid }))
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/resume') && req.method === 'POST') {
        // POST /api/v1/sessions/:id/resume — proxy to daemon, with transcript fallback
        const sid = normalizedPath.split('/')[3]
        let bodyStr = ''
        req.on('data', (chunk: string) => { bodyStr += chunk })
        req.on('end', async () => {
          let body: { cwd?: string; model?: string } = {}
          try { body = JSON.parse(bodyStr) } catch { /* ignore */ }

          // 1. Try daemon first — this loads context into the SDK
          const daemonPort = await getDaemonPort()
          if (daemonPort) {
            try {
              const upstream = await fetch(`http://127.0.0.1:${daemonPort}/api/v1/sessions/${sid}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000),
              })
              if (upstream.ok) {
                const daemonRes = await upstream.json() as { session: Record<string, unknown> }
                // Upsert into monitor state
                if (daemonRes.session?.id) {
                  upsertSession(daemonRes.session.id as string, {
                    sessionId: daemonRes.session.id as string,
                    cwd: (daemonRes.session.cwd ?? body.cwd ?? '') as string,
                    status: 'running',
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    model: daemonRes.session.model as string | undefined,
                  }).catch(() => {})
                }
                res.writeHead(201, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify(daemonRes))
                return
              }
            } catch { /* daemon proxy failed — fall through */ }
          }

          // 2. Fallback: standalone resume (daemon not available)
          readMonitorState().then(async state => {
            let session = state.sessions[sid!]
            if (!session) {
              // Try to find CLI session in ~/.claude/projects/
              const home = process.env.HOME || '/home'
              const projectsDir = join(home, '.claude', 'projects')
              try {
                const { readdir, stat } = await import('fs/promises')
                const dirs = await readdir(projectsDir, { withFileTypes: true })
                for (const dir of dirs) {
                  if (!dir.isDirectory()) continue
                  const candidate = join(projectsDir, dir.name, `${sid}.jsonl`)
                  try {
                    const stats = await stat(candidate)
                    if (stats) {
                      session = {
                        sessionId: sid!,
                        cwd: body.cwd ?? '',
                        status: 'running',
                        transcriptPath: candidate,
                        createdAt: Date.now(),
                        updatedAt: Date.now(),
                        pid: 0,
                      }
                      await upsertSession(sid!, session)
                      break
                    }
                  } catch { /* not in this dir */ }
                }
              } catch { /* projects dir not accessible */ }
            }
            if (session) {
              upsertSession(sid!, { ...session, status: 'running', updatedAt: Date.now() })
                .then(async () => {
                  let transcriptEntries: any[] = []
                  try {
                    const entries = await readFullTranscript(sid!)
                    transcriptEntries = entries.slice(-200).map(e => ({
                      type: e.type,
                      message: e.type === 'user' || e.type === 'assistant' ? {
                        role: e.type,
                        content: e.text ? [{ type: 'text', text: e.text }] : (e.blocks || []).map((b: any) => ({
                          type: b.kind === 'text' ? 'text' : b.kind === 'tool_use' ? 'tool_use' : b.kind === 'thinking' ? 'thinking' : 'text',
                          text: b.text || b.thinking || '',
                          ...(b.kind === 'tool_use' ? { name: b.toolName, input: b.toolInput } : {}),
                        })),
                      } : undefined,
                    })).filter(e => e.message)
                  } catch { /* best effort */ }
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({
                    session: {
                      id: sid,
                      cwd: session.cwd || process.env.HOME || '/home',
                      model: session.model || 'ultra/glm-5.2',
                      transcriptEntries,
                    },
                  }))
                }).catch(err => {
                  res.writeHead(500, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Resume failed' }))
                })
            } else {
              res.writeHead(404, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ ok: false, error: 'Session not found in monitor state or CLI sessions' }))
            }
          }).catch(() => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Read state failed' }))
          })
        })
        return
      } else if (normalizedPath.startsWith('/api/sessions/') && !normalizedPath.includes('/capture') && !normalizedPath.includes('/usage') && !normalizedPath.includes('/full') && !normalizedPath.includes('/transcript') && !normalizedPath.includes('/chat') && !normalizedPath.includes('/model') && !normalizedPath.includes('/interrupt') && !normalizedPath.includes('/resume') && req.method === 'DELETE') {
        // DELETE /api/v1/sessions/:id — delete session
        const sid = normalizedPath.split('/')[3]
        if (sid) {
          ptyRelay.destroySession(sid)
          readMonitorState().then(state => {
            const session = state.sessions[sid]
            if (session?.pid) {
              try { killProcess(session.pid) } catch { /* pid gone */ }
            }
          }).catch(() => {})
        }
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, sessionId: sid }))
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/capture') && req.method === 'GET') {
        // Screen capture: read the session's TTY and return a text snapshot.
        // On Linux, we can read the TTY's current content via /proc/{pid}/fd
        // or by snapshotting the running terminal. For now, return the
        // last terminal-stream buffer if available, or a placeholder.
        const sid = normalizedPath.split('/')[3]
        if (!sid) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Missing sessionId' }))
          return
        }
        readMonitorState().then(state => {
          const session = state.sessions[sid]
          if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
            return
          }
          // Try to capture the TTY content via the 'script' command on Linux.
          // This is a best-effort snapshot — real terminal screen capture
          // requires a PTY recorder, which we don't have here.
          captureTerminalSnapshot(session).then(snapshot => {
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, snapshot, tty: session.tty, sessionId: sid }))
          }).catch(err => {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Capture failed' }))
          })
        }).catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Read state failed' }))
        })
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/usage') && req.method === 'GET') {
        // Cost tracking: aggregate token usage from the transcript.
        const sid = normalizedPath.split('/')[3]
        if (!sid) {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Missing sessionId' }))
          return
        }
        readMonitorState().then(async state => {
          const session = state.sessions[sid]
          if (!session) {
            res.writeHead(404, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Session not found' }))
            return
          }
          try {
            const usage = await computeSessionUsage(sid)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, ...usage }))
          } catch (err) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: (err as Error)?.message ?? 'Usage failed' }))
          }
        }).catch(() => {
          res.writeHead(500, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Read state failed' }))
        })
      } else if (normalizedPath === '/api/settings/permission-mode' && req.method === 'POST') {
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as { mode?: string }
            _permissionMode = data.mode ?? 'default'
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/transcript')) {
        const sid = normalizedPath.split('/')[3]
        if (sid) {
          const msgs = await readTranscript(sid)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ messages: msgs }))
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Invalid session ID' }))
        }
      } else if (normalizedPath.startsWith('/api/sessions/') && normalizedPath.endsWith('/full')) {
        const sid = normalizedPath.split('/')[3]
        if (sid) {
          let entries = await readFullTranscript(sid)
          // Limit entries returned to avoid browser freezing on long sessions
          const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
          const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '200', 10) || 200, 2000)
          if (entries.length > limit) {
            entries = entries.slice(-limit)
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ entries }))
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ ok: false, error: 'Invalid session ID' }))
        }
      } else if (normalizedPath === '/api/settings') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({
          model: _modelSetting,
          permissionMode: _permissionMode,
          tokenRate: 42,
        }))
      } else if (normalizedPath === '/api/tabs/cache' && req.method === 'GET') {
        // GET /api/v1/tabs/cache — restore tab layout from server
        const tabs = await loadTabCache()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ tabs }))
      } else if (normalizedPath === '/api/tabs/cache' && req.method === 'POST') {
        // POST /api/v1/tabs/cache — save tab layout to server
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', async () => {
          try {
            const data = JSON.parse(body) as { tabs: TabCacheEntry[] }
            await saveTabCache(data.tabs)
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true }))
          } catch (err) {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: (err as Error).message }))
          }
        })
      } else if (normalizedPath === '/api/commands' || normalizedPath === '/api/v1/commands') {
        // Proxy from daemon if available, else empty list
        getDaemonPort().then(async (daemonPort) => {
          if (daemonPort) {
            try {
              const resp = await fetch(`http://127.0.0.1:${daemonPort}/api/v1/commands`, { signal: AbortSignal.timeout(2000) })
              if (resp.ok) {
                const body = await resp.text()
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(body)
                return
              }
            } catch { /* fall through */ }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ commands: [] }))
        }).catch(() => {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ commands: [] }))
        })
      } else if (normalizedPath === '/api/models' || normalizedPath === '/api/v1/models') {
        // Try daemon API first, fall back to Verboo API, fall back to hardcoded list
        serveModels(res).catch(() => {
          /* serveModels already handles fallback internally */
        })
      } else if (normalizedPath === '/api/pty/create' && req.method === 'POST') {
        // Create a new PTY session
        let body = ''
        req.on('data', (chunk: string) => { body += chunk })
        req.on('end', () => {
          try {
            const data = JSON.parse(body) as {
              sessionId?: string
              shell?: string
              cols?: number
              rows?: number
              cwd?: string
            }
            // PTY sessions are created via WebSocket, not HTTP
            // This endpoint just returns info about existing sessions
            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: true, sessions: ptyRelay.listSessions() }))
          } catch {
            res.writeHead(400, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ ok: false, error: 'Invalid JSON' }))
          }
        })
      } else if (normalizedPath === '/api/pty/sessions' && req.method === 'GET') {
        // List active PTY sessions
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ sessions: ptyRelay.listSessions() }))
      } else if (normalizedPath === '/api/fs/home' && req.method === 'GET') {
        // Return user's home directory
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ path: process.env.HOME || '/home' }))
      } else if (normalizedPath === '/api/fs/list' && req.method === 'GET') {
        // List directory contents
        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
        const dirPath = url.searchParams.get('path') || '/'
        try {
          const { readdir, stat } = await import('fs/promises')
          const entries = await readdir(dirPath, { withFileTypes: true })
          const result = entries
            .filter(e => !e.name.startsWith('.'))
            .map(e => ({
              name: e.name,
              type: e.isDirectory() ? 'directory' : 'file',
              size: 0,
            }))
            .sort((a, b) => {
              if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
              return a.name.localeCompare(b.name)
            })
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ path: dirPath, entries: result }))
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ path: dirPath, entries: [] }))
        }
      } else if (normalizedPath === '/api/processes' && req.method === 'GET') {
        // List running processes (best effort)
        try {
          const { execFile } = await import('child_process')
          const { promisify } = await import('util')
          const execFileAsync = promisify(execFile)
          let processes: Array<{ pid: number; name: string; cwd: string }> = []
          if (process.platform === 'linux' || process.platform === 'darwin') {
            try {
              const { stdout } = await execFileAsync('ps', ['aux'], { timeout: 3000 })
              const lines = stdout.trim().split('\n').slice(1, 21)
              processes = lines.map(line => {
                const parts = line.trim().split(/\s+/)
                const cmdline = parts.slice(10).join(' ') || 'unknown'
                return { pid: parseInt(parts[1]) || 0, cmdline, cwd: '/' }
              })
            } catch { /* ps not available */ }
          }
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ processes }))
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ processes: [] }))
        }
      } else if (normalizedPath === '/api/cli-sessions' && req.method === 'GET') {
        // Proxy from daemon if available
        const daemonPort = await getDaemonPort()
        if (daemonPort) {
          try {
            const resp = await fetch(`http://127.0.0.1:${daemonPort}/api/v1/cli-sessions`, { signal: AbortSignal.timeout(2000) })
            if (resp.ok) {
              const body = await resp.text()
              res.writeHead(200, { 'Content-Type': 'application/json' })
              res.end(body)
              return
            }
          } catch { /* fall through */ }
        }
        // Fallback: standalone scan
        try {
          const { readdir, stat, readFile } = await import('fs/promises')
          const home = process.env.HOME || '/home'
          const projectsDir = join(home, '.claude', 'projects')
          const sessions: Array<{ id: string; project: string; cwd: string | null; size: number; modifiedAt: number }> = []
          try {
            const dirs = await readdir(projectsDir, { withFileTypes: true })
            for (const dir of dirs) {
              if (!dir.isDirectory()) continue
              const projectPath = join(projectsDir, dir.name)
              try {
                const files = await readdir(projectPath)
                for (const file of files) {
                  if (!file.endsWith('.jsonl')) continue
                  const filePath = join(projectPath, file)
                  const stats = await stat(filePath)
                  // Scan first 20 lines for cwd
                  let cwd: string | null = null
                  try {
                    const content = await readFile(filePath, { encoding: 'utf-8' })
                    const lines = content.split('\n')
                    for (let i = 0; i < Math.min(lines.length, 20); i++) {
                      const line = lines[i].trim()
                      if (!line) continue
                      const parsed = JSON.parse(line)
                      if (parsed.cwd) { cwd = parsed.cwd; break }
                    }
                  } catch { /* skip */ }
                  sessions.push({
                    id: file.replace('.jsonl', ''),
                    project: dir.name,
                    cwd,
                    size: stats.size,
                    modifiedAt: stats.mtimeMs,
                  })
                }
              } catch { /* skip */ }
            }
          } catch { /* projects dir not found */ }
          sessions.sort((a, b) => b.modifiedAt - a.modifiedAt)
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ sessions: sessions.slice(0, 30) }))
        } catch {
          res.writeHead(200, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ sessions: [] }))
        }
      } else if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, uptime: process.uptime(), url: primaryUrl }))
      } else if (path === '/qr') {
        try {
          const svg = await qrToString(primaryUrl, { type: 'svg', errorCorrectionLevel: 'M' })
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
          res.end(svg)
        } catch { res.writeHead(500); res.end('QR error') }
      } else {
        res.writeHead(404); res.end('Not found')
      }
    } catch (err: unknown) {
      if (!res.headersSent) { res.writeHead(500, { 'Content-Type': 'text/plain' }); res.end('Error') }
    }
  })

  // Manually handle WS upgrade events (more reliable than auto-attach to http server under bun:node)
  const wss = new WebSocketServer({ noServer: true })
  httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    // Accept both /ws (monitor) and /api/v1/ws (Lit frontend)
    if (url.pathname !== '/ws' && url.pathname !== '/api/v1/ws') {
      socket.destroy()
      return
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req)
    })
  })
  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    // If token was provided via query param, the connection is already authed.
    // Otherwise, require the first message frame to be {type:"auth", token:"..."}.
    const upgradeUrl = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const queryToken = upgradeUrl.searchParams.get('token')
    const sessionId = upgradeUrl.searchParams.get('session_id')
    let wsAuthed = TOKEN_SKIP || !_authToken || (queryToken === _authToken)
    const isLitFrontend = upgradeUrl.pathname === '/api/v1/ws'

    connections.add(ws)
    _wsConns.add(ws)
    if (isLitFrontend) _litConnections.add(ws)
    if (wsAuthed) {
      // Auto-subscribe to transcript if session_id is provided in URL
      if (sessionId) {
        handleSubscribeTranscript(ws, sessionId)
      }
      // Send initial state — translate for Lit frontend if needed
      readMonitorState().then(state => {
        if (ws.readyState === ws.OPEN) {
          if (isLitFrontend) {
            // Lit frontend gets sessions from REST API, no need to send all on WS
            ws.send(JSON.stringify({ type: 'connected', sessionId: sessionId || 'monitor' }))
          } else {
            ws.send(JSON.stringify({ type: 'update', sessions: Object.values(state.sessions) }))
          }
        }
      }).catch(() => {})
    }

    ws.on('message', (raw: Buffer | string) => {
      let data: { type?: string; sessionId?: string; text?: string; mode?: string; model?: string; submit?: boolean; token?: string }
      try {
        data = JSON.parse(raw.toString())
      } catch {
        return
      }
      // First-frame auth: if not yet authed, only accept {type:"auth", token:"..."}.
      if (!wsAuthed) {
        if (data.type === 'auth' && data.token && data.token === _authToken) {
          wsAuthed = true
          readMonitorState().then(state => {
            if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: 'update', sessions: Object.values(state.sessions) }))
          }).catch(() => {})
        } else {
          // Invalid auth — close the connection.
          ws.close(4001, 'Unauthorized')
        }
        return
      }
      if (data.type === 'stop' && data.sessionId) {
        readMonitorState().then(state => {
          const session = state.sessions[data.sessionId!]
          if (session?.pid) {
            try { killProcess(session.pid) } catch { /* pid gone */ }
          }
        }).catch(() => {})
      } else if (data.type === 'send-text' && data.sessionId && data.text != null) {
        readMonitorState().then(state => {
          const session = state.sessions[data.sessionId!]
          if (session?.tty && data.text) {
            const text = data.submit ? String(data.text) + '\r' : String(data.text)
            injectInput(String(session.tty), text, session.sessionId, session.tmuxSession)
          }
        }).catch(() => {})
      } else if (data.type === 'set-mode' && data.mode) {
        _permissionMode = data.mode
      } else if (data.type === 'set-model' && data.model) {
        _modelSetting = data.model
      } else if (data.type === 'subscribe-transcript' && data.sessionId) {
        // Subscribe this client to live transcript updates for a session.
        // Server opens fs.watch on the JSONL file and pushes deltas.
        handleSubscribeTranscript(ws, data.sessionId)
      } else if (data.type === 'unsubscribe-transcript') {
        handleUnsubscribeTranscript(ws)
      } else if (data.type === 'pty_create') {
        // Create a new PTY session
        try {
          const sessionId = ptyRelay.createSession(ws, {
            sessionId: data.sessionId,
            shell: (data as any).shell,
            cols: (data as any).cols || 80,
            rows: (data as any).rows || 24,
            cwd: (data as any).cwd,
          })
          if (sessionId && ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'session_state', sessionId, state: 'running' }))
          }
        } catch { /* ignore */ }
      } else if (data.type === 'pty_input' && data.sessionId) {
        // Send input to a PTY session
        ptyRelay.writeInput(data.sessionId, (data as any).data || '')
      } else if (data.type === 'pty_resize' && data.sessionId) {
        // Resize a PTY session
        ptyRelay.resize(data.sessionId, (data as any).cols || 80, (data as any).rows || 24)
      } else if (data.type === 'pty_kill' && data.sessionId) {
        // Kill a PTY session
        ptyRelay.destroySession(data.sessionId)
      } else if (data.type === 'input' && data.sessionId) {
        // Lit frontend input format — forward to PTY or existing session
        const input = (data as any).message
        if (input) {
          // Try PTY first, then fall back to injectInput
          if (!ptyRelay.writeInput(data.sessionId, input)) {
            readMonitorState().then(state => {
              const session = state.sessions[data.sessionId!]
              if (session?.tty) {
                injectInput(String(session.tty), input, session.sessionId, session.tmuxSession)
              }
            }).catch(() => {})
          }
        }
      } else if (data.type === 'interrupt' && data.sessionId) {
        // Lit frontend interrupt — send Ctrl+C
        ptyRelay.writeInput(data.sessionId, String.fromCharCode(3))
      }
    })

    ws.on('close', () => {
      connections.delete(ws)
      _wsConns.delete(ws)
      _litConnections.delete(ws)
      handleUnsubscribeTranscript(ws)
      // Cleanup any PTY sessions owned by this connection
      for (const session of ptyRelay.listSessions()) {
        const ptySession = ptyRelay.getSession(session.id)
        if (ptySession?.ws === ws) {
          ptyRelay.destroySession(session.id)
        }
      }
    })
    ws.on('error', () => {
      connections.delete(ws)
      _wsConns.delete(ws)
      handleUnsubscribeTranscript(ws)
    })
  })

  let watchAbort: AbortController | undefined
  try {
    watchAbort = new AbortController()
    const fs = await import('fs')
    fs.watch(getMonitorDir(), { signal: watchAbort.signal }, async () => {
      try {
        broadcastUpdate()
      } catch { }
    })
  } catch { }

  // Polling backup: broadcast state every 5s so UI reflects running/waiting/stopped
  // accurately even when fs.watch misses events (WSL, network mounts, etc.)
  setInterval(() => { broadcastUpdate().catch(() => {}) }, 5000)

  async function broadcastUpdate() {
    const state = await readMonitorState()
    const sessions = Object.values(state.sessions)
    // Only send full update to non-Lit connections (monitor HTML)
    for (const ws of connections) {
      if (!_litConnections.has(ws) && ws.readyState === ws.OPEN) {
        try { ws.send(JSON.stringify({ type: 'update', sessions })) } catch { /* ignore */ }
      }
    }
    // For Lit frontend, only send state changes (not full list)
    detectActivityEvents(state.sessions)
  }

  function detectActivityEvents(sessions: Record<string, { sessionId: string; status: string; name?: string }>) {
    const now = Date.now()
    for (const sid of Object.keys(sessions)) {
      const session = sessions[sid]
      const prev = _lastSessionStates[sid]
      if (prev === undefined) {
        // New session detected
        _lastSessionStates[sid] = session.status
        emitActivity({
          type: 'session-start', sessionId: sid, from: '', to: session.status,
          timestamp: now, sessionName: session.name,
        })
      } else if (prev !== session.status) {
        _lastSessionStates[sid] = session.status
        emitActivity({
          type: 'state-change', sessionId: sid, from: prev, to: session.status,
          timestamp: now, sessionName: session.name,
        })
      }
    }
    // Detect stopped/removed sessions
    for (const sid of Object.keys(_lastSessionStates)) {
      if (!sessions[sid]) {
        emitActivity({
          type: 'session-stop', sessionId: sid, from: _lastSessionStates[sid], to: 'removed',
          timestamp: now,
        })
        delete _lastSessionStates[sid]
      }
    }
  }

  function emitActivity(event: ActivityEvent) {
    _activityFeed.push(event)
    if (_activityFeed.length > MAX_ACTIVITY_EVENTS) _activityFeed.shift()
    const sse = `data: ${JSON.stringify(event)}\n\n`
    for (const res of _activityClients) {
      try { res.write(sse) } catch { /* client gone */ }
    }
  }

  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, '0.0.0.0', () => {
      resolve()
      // Start background session stream connectors
      connectToSessions()
    })
    httpServer.once('error', reject)
  })
  const actualPort = (httpServer.address() as AddressInfo)?.port ?? port

  const wslIP = localIPs.find(ip => ip.startsWith('172.')) ?? null
  const serveTarget = wslIP ? `http://${wslIP}:${actualPort}` : `http://127.0.0.1:${actualPort}`
  const tsReady = tailscaleIsInstalled()
  if (tsReady) {
    const result = await tailscalePublish(actualPort, isPublic, serveTarget)
    if (result?.url) urls.unshift(result.url)
  }

  const cleanupFn = async () => {
    try { if (tsReady) await tailscaleUnpublish() } catch { }
    watchAbort?.abort()
    // Close all transcript subscriptions
    for (const ws of _transcriptSubs.keys()) {
      handleUnsubscribeTranscript(ws)
    }
    // Cleanup all PTY sessions
    ptyRelay.destroyAll()
    wss.close()
    connections.clear()
    await new Promise<void>(resolve => httpServer.close(() => resolve()))
  }
  registerCleanup(cleanupFn)
  _activeCleanup = cleanupFn

  return { stop: cleanupFn, url: primaryUrl, urls: [...new Set(urls)], port: actualPort }
}

let _activeCleanup: (() => Promise<void>) | null = null
export async function stopMonitorServer(): Promise<void> {
  if (!_activeCleanup) return
  const fn = _activeCleanup; _activeCleanup = null
  await fn()
}
