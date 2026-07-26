/**
 * Session monitor state: one file per session.
 *
 * Instead of a shared JSON with locks (which causes conflicts between
 * processes), each Verboo Code process owns its own file at
 * `~/.verboo/monitor/{sessionId}.json`. The reader scans the directory
 * and merges all entries. No lock needed — each pid writes only its own
 * file and deletes it on shutdown.
 */

import { writeFile, mkdir, readFile, readdir, unlink } from 'fs/promises'
import { readlinkSync } from 'fs'
import { join, extname } from 'path'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { logForDebugging } from '../debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorSessionStatus = 'running' | 'waiting_input' | 'stopped'

export type MonitorSession = {
  sessionId: string
  agentId?: string
  parentSessionId?: string
  cwd: string
  status: MonitorSessionStatus
  tty?: string
  tmuxSession?: string
  transcriptPath?: string
  createdAt: number
  updatedAt: number
  lastMessage?: string
  model?: string
  pid: number
  name?: string
}

export type TabCacheEntry = {
  sessionId: string
  type: 'sdk' | 'pty' | 'attach'
  model: string
  title: string
  cwd: string
  createdAt: number
}

export type MonitorStateFile = {
  version: 1
  updatedAt: number
  sessions: Record<string, MonitorSession>
}

/** Server-side tab cache: restored on F5 or browser switch */
export type TabCache = {
  tabs: TabCacheEntry[]
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MONITOR_DIR = 'monitor'

export function getMonitorDir(): string {
  return join(getClaudeConfigHomeDir(), MONITOR_DIR)
}

function sessionFilePath(sessionId: string): string {
  return join(getMonitorDir(), `${sanitizeId(sessionId)}.json`)
}

function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9_-]/g, '_')
}

// ---------------------------------------------------------------------------
// TTY detection
// ---------------------------------------------------------------------------

/**
 * Detect the TTY device path for the current process.
 *
 * Strategy:
 *   1. Check SSH_TTY / TMUX env vars (already set by SSH/tmux).
 *   2. Read the symlink at /proc/self/fd/{stdin_fd} (Linux/WSL).
 *   3. Run `tty` command (macOS/other Unix).
 *
 * Returns undefined if no TTY is detected (e.g. piped stdin).
 */
export function detectTTYPath(): string | undefined {
  // Already known from env
  if (process.env.SSH_TTY) return process.env.SSH_TTY
  if (process.env.TMUX) {
    // tmux doesn't set a TTY env var, but we can get it from the `tty` command
    // or from /proc/self/fd. Fall through to platform detection.
  }
  if (!process.stdin.isTTY && !process.stdout.isTTY) return undefined

  try {
    // Linux / WSL: readlink /proc/self/fd/0 → "/dev/pts/4"
    const stdinFd = process.stdin.isTTY ? (process.stdin.fd ?? 0) : 1
    const path = `/proc/self/fd/${stdinFd}`
    const target = readlinkSync(path)
    if (target && !target.startsWith('/proc/') && !target.startsWith('pipe:')) return target
  } catch { /* not Linux */ }

  try {
    // macOS / other Unix: run `tty` command
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { execSync } = require('child_process')
    const result = execSync('tty', { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] }).trim()
    if (result && result !== 'not a tty') return result
  } catch { /* no tty command or error */ }

  return undefined
}

// ---------------------------------------------------------------------------
// I/O — one file per session, no locks
// ---------------------------------------------------------------------------

/**
 * Read all session files and merge into a single MonitorStateFile.
 */
export async function readMonitorState(): Promise<MonitorStateFile> {
  const dir = getMonitorDir()
  const sessions: Record<string, MonitorSession> = {}

  let files: string[]
  try {
    files = await readdir(dir)
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return { version: 1, updatedAt: Date.now(), sessions: {} }
    }
    logForDebugging(`[Monitor] readdir failed: ${e.message}`, { level: 'warn' })
    return { version: 1, updatedAt: Date.now(), sessions: {} }
  }

  const now = Date.now()
  const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

  for (const name of files) {
    if (extname(name) !== '.json') continue
    const path = join(dir, name)
    try {
      const raw = await readFile(path)
      const s = JSON.parse(raw.toString()) as MonitorSession
      if (!s || !s.sessionId) continue

      // Auto-cleanup: skip sessions older than 24h
      if (s.createdAt && now - s.createdAt > MAX_AGE_MS) continue

      // Stale PID detection: if status is 'running' but the PID is from
      // a different process and no longer alive, mark as 'stopped'.
      if (s.status === 'running' && s.pid && s.pid !== process.pid) {
        try {
          process.kill(s.pid, 0)
        } catch {
          s.status = 'stopped'
        }
      }

      sessions[s.sessionId] = s
    } catch (err: unknown) {
      // Stale / corrupt file — skip
      logForDebugging(`[Monitor] skipping corrupt file ${name}: ${(err as Error)?.message}`, { level: 'debug' })
    }
  }

  return { version: 1, updatedAt: Date.now(), sessions }
}

/**
 * Write (overwrite) a single session file. No lock needed — each process
 * owns its own file.
 */
export async function upsertSession(
  sessionId: string,
  data: Partial<MonitorSession>,
): Promise<void> {
  const dir = getMonitorDir()
  await mkdir(dir, { recursive: true })

  const path = sessionFilePath(sessionId)
  const entry: MonitorSession = {
    sessionId,
    cwd: '',
    status: 'stopped',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pid: 0,
    ...data,
    updatedAt: Date.now(),
  }

  try {
    await writeFile(path, JSON.stringify(entry, null, 2))
  } catch (err: unknown) {
    logForDebugging(
      `[Monitor] upsertSession failed: ${(err as Error)?.message ?? err}`,
      { level: 'error' },
    )
  }
}

/**
 * Remove a single session file.
 */
export async function removeSession(sessionId: string): Promise<void> {
  try {
    await unlink(sessionFilePath(sessionId))
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code !== 'ENOENT') {
      logForDebugging(`[Monitor] removeSession failed: ${e.message}`, { level: 'warn' })
    }
  }
}

// ---------------------------------------------------------------------------
// Tab cache — persists browser tab layout between sessions and browsers
// ---------------------------------------------------------------------------

function tabCachePath(): string {
  return join(getMonitorDir(), 'tabs.json')
}

export async function loadTabCache(): Promise<TabCacheEntry[]> {
  try {
    const raw = await readFile(tabCachePath(), 'utf-8')
    const parsed = JSON.parse(raw) as { tabs?: TabCacheEntry[] }
    return parsed.tabs ?? []
  } catch {
    return []
  }
}

export async function saveTabCache(tabs: TabCacheEntry[]): Promise<void> {
  const dir = getMonitorDir()
  await mkdir(dir, { recursive: true })
  await writeFile(tabCachePath(), JSON.stringify({ tabs, updatedAt: Date.now() }, null, 2))
}
