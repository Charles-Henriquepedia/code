import { createServer, type Server, type IncomingMessage, type ServerResponse } from 'node:http'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { RuntimeRegistry } from '../../core/runtime/RuntimeRegistry.js'
import type { SessionManager } from '../../core/session/SessionManager.js'
import type { ConfigService } from '../../core/config/ConfigService.js'
import { EventBus } from '../../core/event/EventBus.js'
import { registerSessionRoutes } from '../routes/sessions.js'
import { registerCommandRoutes } from '../routes/commands.js'
import { registerModelRoutes } from '../routes/models.js'
import { registerHealthRoutes } from '../routes/health.js'
import { registerChatRoutes } from '../routes/chat.js'
import { registerTabRoutes } from '../routes/tabs.js'
import { registerCliSessionRoutes } from '../routes/cli-sessions.js'
import { registerGitRoutes } from '../routes/git.js'
import { registerSearchRoutes } from '../routes/search.js'
import { registerPushRoutes } from '../routes/push.js'
import { WsServer } from './WsServer.js'

export interface ApiDependencies {
  runtimeRegistry: RuntimeRegistry
  sessionManager: SessionManager
  configService: ConfigService
  eventBus: EventBus
}

export class HttpServer {
  private server!: Server
  private wsServer!: WsServer
  private startedAt = Date.now()
  private handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>> = new Map()

  constructor(private deps: ApiDependencies) {}

  async start(port: number, host: string): Promise<void> {
    this.server = createServer(this.handleRequest.bind(this))
    this.wsServer = new WsServer(this.server, this.deps)

    this.registerRoutes()

    // Forward PTY output events to WebSocket clients
    const ptyRuntime = this.deps.runtimeRegistry.get('pty') as
      { events?: EventBus; id?: string } | undefined
    if (ptyRuntime?.events) {
      ptyRuntime.events.on('session.output', (event) => {
        this.wsServer.broadcast(event.sessionId, {
          type: 'pty_output',
          sessionId: event.sessionId,
          data: (event.event as { data?: string })?.data ?? '',
        })
      })
    }

    // Forward transcript appends (live sync CLI <-> web) to WebSocket clients
    const verbooRuntime = this.deps.runtimeRegistry.get('verboo') as
      { events?: EventBus } | undefined
    if (verbooRuntime?.events) {
      verbooRuntime.events.on('session.transcript_append', (event) => {
        this.wsServer.broadcast(event.sessionId, {
          type: 'transcript_append',
          sessionId: event.sessionId,
          entry: event.entry,
        })
      })
      verbooRuntime.events.on('session.lock_acquired', (event) => {
        this.wsServer.broadcast(event.sessionId, {
          type: 'lock_acquired',
          sessionId: event.sessionId,
          owner: event.owner,
        })
      })
      verbooRuntime.events.on('session.lock_released', (event) => {
        this.wsServer.broadcast(event.sessionId, {
          type: 'lock_released',
          sessionId: event.sessionId,
          owner: event.owner,
        })
      })
    }

    return new Promise((resolvePromise) => {
      this.server.listen(port, host, () => {
        console.log(`Daemon API server listening on http://${host}:${port}`)
        resolvePromise()
      })
    })
  }

  async stop(): Promise<void> {
    this.wsServer.close()
    return new Promise((resolvePromise) => {
      this.server.close(() => resolvePromise())
    })
  }

  getWsServer(): WsServer {
    return this.wsServer
  }

  getStartedAt(): number {
    return this.startedAt
  }

  private registerRoutes(): void {
    registerSessionRoutes(this.handlers, this.deps)
    registerCommandRoutes(this.handlers, this.deps)
    registerModelRoutes(this.handlers, this.deps)
    registerHealthRoutes(this.handlers, this.deps)
    registerChatRoutes(this.handlers, this.deps)
    registerTabRoutes(this.handlers, this.deps)
    registerCliSessionRoutes(this.handlers, this.deps)
    registerGitRoutes(this.handlers, this.deps)
    registerSearchRoutes(this.handlers, this.deps)
    registerPushRoutes(this.handlers, this.deps)
    this.registerCorsPreflight()
  }

  private registerCorsPreflight(): void {
    this.handlers.set('OPTIONS', async (_req, res) => {
      this.setCorsHeaders(res)
      res.writeHead(204)
      res.end()
    })
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    this.setCorsHeaders(res)
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const method = req.method ?? 'GET'
    const key = `${method}:${url.pathname}`

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const matched = this.handlers.get(key)
      ? { handler: this.handlers.get(key)!, params: {} as Record<string, string> }
      : this.matchPattern(key)
    const { handler, params } = matched ?? {}
    if (!handler) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not found', code: 'NOT_FOUND', statusCode: 404 }))
      return
    }

    let body = ''
    if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
      body = await this.readBody(req)
    }

    try {
      ;(req as unknown as { params?: Record<string, string> }).params = params
      await handler(req, res, body)
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error', code: 'INTERNAL_ERROR', statusCode: 500 }))
    }
  }

  private matchPattern(key: string): { handler: (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>; params: Record<string, string> } | undefined {
    for (const [pattern, handler] of this.handlers) {
      const patternParts = pattern.split('/')
      const keyParts = key.split('/')
      if (patternParts.length !== keyParts.length) continue

      let match = true
      const params: Record<string, string> = {}
      for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
          params[patternParts[i].slice(1)] = keyParts[i]
        } else if (patternParts[i] !== keyParts[i]) {
          match = false
          break
        }
      }
      if (match) {
        return { handler, params }
      }
    }
    return undefined
  }

  private readBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolvePromise) => {
      const chunks: Buffer[] = []
      req.on('data', (chunk: Buffer) => chunks.push(chunk))
      req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf-8')))
    })
  }

  private setCorsHeaders(res: ServerResponse): void {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  }
}
