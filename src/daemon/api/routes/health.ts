import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'
import { PROTOCOL_VERSION } from '../../types/rpc.js'

const startedAt = Date.now()

export function registerHealthRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/health', async (_req, res) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const health = {
      status: 'ok' as const,
      uptime,
      sessions: deps.sessionManager.count(),
      version: '0.1.0',
      runtimes: deps.runtimeRegistry.list().map((r) => r.id),
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(health))
  })

  handlers.set('GET:/api/v1/info', async (_req, res) => {
    const uptime = Math.floor((Date.now() - startedAt) / 1000)
    const info = {
      version: '0.1.0',
      protocolVersion: PROTOCOL_VERSION,
      runtimes: deps.runtimeRegistry.list().map((r) => r.name),
      uptime,
      daemonPid: process.pid,
      startedAt: new Date(startedAt).toISOString(),
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify(info))
  })
}
