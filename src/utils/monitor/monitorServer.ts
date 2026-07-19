/**
 * Lightweight HTTP + WebSocket server for the session monitor.
 *
 * Serves the shared sessions.json as a REST API, streams live updates via
 * WebSocket, and auto-publishes to Tailscale when available.
 *
 * Zero external dependencies beyond ws and qrcode (both in package.json).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { WebSocketServer, type WebSocket } from 'ws'
import { networkInterfaces, hostname } from 'os'
import { toString as qrToString } from 'qrcode'
import type { AddressInfo } from 'net'
import { readMonitorState, getStateFilePath } from './monitorStateFile.js'
import { execFileNoThrow } from '../execFileNoThrow.js'
import { registerCleanup } from '../cleanupRegistry.js'
import { logForDebugging } from '../debug.js'

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
const TS_PUBLISH_RETRIES = 3
const TS_RETRY_DELAY_MS = 500

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
  try {
    const { stdout } = await execFileNoThrow('tailscale', ['ip', '-4'], {
      timeout: 5000,
    })
    const ip = stdout?.trim()
    if (ip && /^\d+\.\d+\.\d+\.\d+$/.test(ip)) return ip
  } catch {
    // tailscale not installed or not running
  }
  return null
}

async function detectTailscaleHostname(): Promise<string | null> {
  try {
    const { stdout } = await execFileNoThrow('tailscale', ['status', '--self', '--json'], {
      timeout: 5000,
    })
    if (!stdout) return null
    const data = JSON.parse(stdout) as { Self?: { DNSName?: string } }
    const dns = data?.Self?.DNSName
    if (dns) return dns.replace(/\.$/, '') // strip trailing dot
  } catch {
    // not available
  }
  return null
}

function tailscaleIsInstalled(): boolean {
  try {
    const { execFileSync } = require('child_process')
    execFileSync('tailscale', ['version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Tailscale publish / unpublish
// ---------------------------------------------------------------------------

async function tailscalePublish(port: number, isPublic: boolean): Promise<{ url: string } | null> {
  const mode = isPublic ? 'funnel' : 'serve'
  const args = [mode, '--bg', '--yes', `--https=443`, `http://127.0.0.1:${port}`]

  for (let attempt = 0; attempt < TS_PUBLISH_RETRIES; attempt++) {
    try {
      const { code, stderr } = await execFileNoThrow('tailscale', args, {
        timeout: 15000,
      })
      if (code === 0) {
        // Grab the URL from the output
        const host = await detectTailscaleHostname()
        const url = host ? `https://${host}` : `https://${await detectTailscaleIP() ?? 'localhost'}`
        logForDebugging(
          `[Monitor] Tailscale ${mode} published: ${url}`,
          { level: 'info' },
        )
        return { url }
      }
      logForDebugging(
        `[Monitor] Tailscale ${mode} attempt ${attempt + 1} failed: ${stderr?.slice(0, 200)}`,
        { level: 'warn' },
      )
    } catch (err: unknown) {
      logForDebugging(
        `[Monitor] Tailscale ${mode} attempt ${attempt + 1} error: ${(err as Error)?.message}`,
        { level: 'warn' },
      )
    }
    if (attempt < TS_PUBLISH_RETRIES - 1) {
      await new Promise(r => setTimeout(r, TS_RETRY_DELAY_MS))
    }
  }
  return null
}

async function tailscaleUnpublish(): Promise<void> {
  try {
    await execFileNoThrow('tailscale', ['serve', '--https=443', 'off'], {
      timeout: 10000,
    })
    await execFileNoThrow('tailscale', ['funnel', '--https=443', 'off'], {
      timeout: 10000,
    })
  } catch {
    // best effort
  }
}

// ---------------------------------------------------------------------------
// Mobile web UI (inline HTML, zero frameworks)
// ---------------------------------------------------------------------------

function renderMobileHTML(wsUrl: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<title>Verboo Monitor</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0d1117;color:#c9d1d9;padding:16px;padding-bottom:80px}
h1{font-size:1.2em;margin-bottom:12px;color:#58a6ff}
.session{background:#161b22;border:1px solid #30363d;border-radius:8px;padding:12px;margin-bottom:8px}
.session.running{border-left:3px solid #3fb950}
.session.waiting_input{border-left:3px solid #d29922}
.session.stopped{border-left:3px solid #484f58;opacity:.6}
.row{display:flex;justify-content:space-between;align-items:center;margin-bottom:4px}
.status{font-size:.9em;font-weight:600}
.status.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}
.dot.running{background:#3fb950}
.dot.waiting_input{background:#d29922}
.dot.stopped{background:#484f58}
.id{font-size:.8em;color:#8b949e;font-family:monospace}
.cwd{font-size:.85em;color:#c9d1d9;word-break:break-all}
.meta{font-size:.75em;color:#8b949e;margin-top:4px}
.msg{font-size:.8em;color:#8b949e;margin-top:4px;font-style:italic;word-break:break-word}
.stats{display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.stat{font-size:.85em}
.stat .num{font-weight:600}
.connecting{text-align:center;margin-top:40px;color:#8b949e}
.error{color:#f85149;text-align:center;margin-top:40px}
</style>
</head>
<body>
<h1>Verboo Monitor</h1>
<div id="stats" class="stats"></div>
<div id="sessions"></div>
<div id="status" class="connecting">Connecting...</div>
<script>
(function(){
var ws=null, reconnectTimer=null;
function connect(){
if(ws) try{ws.close()}catch(e){}
ws=new WebSocket('${wsUrl.replace(/^http/, 'ws')}');
ws.onopen=function(){document.getElementById('status').textContent='Live';clearTimeout(reconnectTimer)};
ws.onclose=function(){document.getElementById('status').textContent='Disconnected. Reconnecting...';reconnectTimer=setTimeout(connect,3000)};
ws.onerror=function(){document.getElementById('status').textContent='Connection error'};
ws.onmessage=function(e){try{var data=JSON.parse(e.data);if(data.type==='update')render(data.sessions||[])}catch(err){}};
}
function render(sessions){
var statsEl=document.getElementById('stats');
var listEl=document.getElementById('sessions');
var run=sessions.filter(function(s){return s.status==='running'}).length;
var wait=sessions.filter(function(s){return s.status==='waiting_input'}).length;
var stop=sessions.filter(function(s){return s.status==='stopped'}).length;
statsEl.innerHTML='<span class="stat"><span style="color:#3fb950">●</span> <span class="num">'+run+'</span> running</span><span class="stat"><span style="color:#d29922">◐</span> <span class="num">'+wait+'</span> waiting</span><span class="stat"><span style="color:#484f58">○</span> <span class="num">'+stop+'</span> stopped</span>';
if(sessions.length===0){listEl.innerHTML='<p style="color:#8b949e;text-align:center;margin-top:20px">No sessions found.</p>';return}
var html='';
for(var i=0;i<sessions.length;i++){
var s=sessions[i];
var cls='session '+s.status;
var dotCls='dot '+s.status;
var cwd=s.cwd||'(no cwd)';
var lastMsg=s.lastMessage?s.lastMessage.slice(0,80):'';
var uptime='';
if(s.createdAt){var sec=Math.floor((Date.now()-s.createdAt)/1000);uptime=sec<60?sec+'s':Math.floor(sec/60)+'m '+sec%60+'s'}
html+='<div class="'+cls+'"><div class="row"><span class="status"><span class="'+dotCls+'"></span>'+s.status.replace('_',' ')+'</span><span class="id">'+(s.sessionId?s.sessionId.slice(0,8):'')+'</span></div><div class="cwd">'+escapeHtml(cwd)+'</div><div class="meta">'+(s.model||'')+(uptime?' &middot; '+uptime:'')+'</div>'+(lastMsg?'<div class="msg">'+escapeHtml(lastMsg)+'</div>':'')+'</div>'
}
listEl.innerHTML=html;
}
function escapeHtml(t){if(!t)return '';return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')}
connect();
})();
</script>
</body>
</html>`
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export async function startMonitorServer(
  options: ServerOptions = {},
): Promise<MonitorServer> {
  const port = options.port ?? DEFAULT_PORT
  const isPublic = options.public ?? false

  // ── Detect addresses ──
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

  // ── Create HTTP server ──
  let connections: Set<WebSocket> = new Set()
  const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const path = url.pathname

    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      if (path === '/' || path === '/index.html') {
        const wsUrl = `ws://${req.headers.host ?? `localhost:${port}`}/ws`
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
        res.end(renderMobileHTML(wsUrl))

      } else if (path === '/api/sessions') {
        const state = await readMonitorState()
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(state))

      } else if (path === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ ok: true, uptime: process.uptime(), url: primaryUrl }))

      } else if (path === '/qr') {
        try {
          const svg = await qrToString(primaryUrl, {
            type: 'svg',
            errorCorrectionLevel: 'M',
          })
          res.writeHead(200, { 'Content-Type': 'image/svg+xml' })
          res.end(svg)
        } catch {
          res.writeHead(500)
          res.end('QR generation failed')
        }

      } else {
        res.writeHead(404)
        res.end('Not found')
      }
    } catch (err: unknown) {
      logForDebugging(
        `[Monitor] HTTP error: ${(err as Error)?.message ?? err}`,
        { level: 'error' },
      )
      res.writeHead(500)
      res.end('Internal error')
    }
  })

  // ── WebSocket server ──
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' })

  wss.on('connection', (ws: WebSocket) => {
    connections.add(ws)
    // Send current state immediately
    readMonitorState()
      .then(state => {
        if (ws.readyState === ws.OPEN) {
          ws.send(JSON.stringify({ type: 'update', sessions: Object.values(state.sessions) }))
        }
      })
      .catch(() => {})
    ws.on('close', () => { connections.delete(ws) })
    ws.on('error', () => { connections.delete(ws) })
  })

  // ── Watch state file and broadcast changes ──
  let watchAbort: AbortController | undefined
  try {
    watchAbort = new AbortController()
    const fs = await import('fs')
    const watcher = fs.watch(getStateFilePath(), { signal: watchAbort.signal }, async () => {
      try {
        const state = await readMonitorState()
        const msg = JSON.stringify({ type: 'update', sessions: Object.values(state.sessions) })
        for (const ws of connections) {
          if (ws.readyState === ws.OPEN) {
            ws.send(msg)
          }
        }
      } catch {
        // best effort
      }
    })
  } catch {
    // fs.watch not available or failed
  }

  // ── Start listening ──
  await new Promise<void>((resolve, reject) => {
    httpServer.listen(port, '0.0.0.0', () => {
      resolve()
    })
    httpServer.once('error', reject)
  })

  const actualPort = (httpServer.address() as AddressInfo)?.port ?? port

  logForDebugging(
    `[Monitor] Server started on port ${actualPort}. URLs: ${urls.join(', ')}`,
    { level: 'info' },
  )

  // ── Tailscale publish ──
  const tsReady = tailscaleIsInstalled()
  if (tsReady) {
    const result = await tailscalePublish(actualPort, isPublic)
    if (result?.url) {
      urls.unshift(result.url)
    }
  }

  // ── Register cleanup ──
  const cleanupFn = async () => {
    try {
      if (tsReady) await tailscaleUnpublish()
    } catch { /* best effort */ }
    watchAbort?.abort()
    wss.close()
    connections.clear()
    await new Promise<void>(resolve => httpServer.close(() => resolve()))
    logForDebugging('[Monitor] Server stopped', { level: 'info' })
  }
  registerCleanup(cleanupFn)

  return {
    stop: cleanupFn,
    url: primaryUrl,
    urls: [...new Set(urls)], // deduplicate
    port: actualPort,
  }
}
