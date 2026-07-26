import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'node:http'
import type { RuntimeRegistry } from '../../core/runtime/RuntimeRegistry.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { EventBus } from '../../core/event/EventBus.js'
import type { ApiDependencies } from './HttpServer.js'

interface WsClient {
  ws: WebSocket
  sessionId: string
  alive: boolean
}

export class WsServer {
  private wss!: WebSocketServer
  private clients = new Map<WebSocket, WsClient>()
  private deps: ApiDependencies
  private pingInterval: ReturnType<typeof setInterval> | null = null

  constructor(server: Server, deps: ApiDependencies) {
    this.deps = deps
    this.wss = new WebSocketServer({ server })
    this.setup()
  }

  private setup(): void {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
      const sessionId = url.searchParams.get('session_id') ?? ''

      const client: WsClient = { ws, sessionId, alive: true }
      this.clients.set(ws, client)

      ws.on('pong', () => { client.alive = true })
      ws.on('close', () => { this.clients.delete(ws) })
      ws.on('error', () => { this.clients.delete(ws) })

      ws.on('message', async (raw) => {
        try {
          const msg = JSON.parse(raw.toString())
          await this.handleMessage(client, msg)
        } catch {
          ws.send(JSON.stringify({ type: 'error', error: 'Invalid message format' }))
        }
      })

      ws.send(JSON.stringify({ type: 'connected', sessionId }))
    })

    this.pingInterval = setInterval(() => {
      for (const [ws, client] of this.clients) {
        if (!client.alive) {
          ws.terminate()
          this.clients.delete(ws)
          continue
        }
        client.alive = false
        ws.ping()
      }
    }, 30000)
  }

  private async handleMessage(client: WsClient, msg: Record<string, unknown>): Promise<void> {
    const { deps } = this

    switch (msg.type) {
      case 'input': {
        const runtime = deps.runtimeRegistry.list()[0]
        if (!runtime) {
          client.ws.send(JSON.stringify({ type: 'error', error: 'No runtime available' }))
          return
        }
        try {
          const stream = runtime.submitMessage(client.sessionId, msg.message as string)
          for await (const event of stream) {
            client.ws.send(JSON.stringify({ type: 'stream_event', sessionId: client.sessionId, event }))
          }
        } catch (err) {
          client.ws.send(JSON.stringify({ type: 'error', sessionId: client.sessionId, error: String(err) }))
        }
        break
      }
      case 'interrupt': {
        const runtime = deps.runtimeRegistry.list()[0]
        if (runtime) {
          await runtime.interruptSession(client.sessionId)
        }
        client.ws.send(JSON.stringify({ type: 'interrupted', sessionId: client.sessionId }))
        break
      }
      case 'pty_input': {
        const ptyRuntime = deps.runtimeRegistry.get('pty') as {
          writeToSession?: (id: string, data: string) => void
        } | undefined
        if (ptyRuntime?.writeToSession) {
          ptyRuntime.writeToSession(client.sessionId, msg.data as string)
        }
        break
      }
      case 'pty_resize': {
        const ptyRuntime = deps.runtimeRegistry.get('pty') as {
          resizeSession?: (id: string, cols: number, rows: number) => void
        } | undefined
        if (ptyRuntime?.resizeSession) {
          ptyRuntime.resizeSession(client.sessionId, msg.cols as number, msg.rows as number)
        }
        break
      }
      case 'keep_alive':
        break
      default:
        client.ws.send(JSON.stringify({ type: 'error', error: `Unknown message type: ${msg.type}` }))
    }
  }

  broadcast(sessionId: string, data: unknown): void {
    const payload = JSON.stringify(data)
    for (const client of this.clients.values()) {
      if (client.sessionId === sessionId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload)
      }
    }
  }

  close(): void {
    if (this.pingInterval) clearInterval(this.pingInterval)
    for (const [ws] of this.clients) {
      ws.close()
    }
    this.clients.clear()
    this.wss.close()
  }
}
