import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

export function registerCommandRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/commands', async (_req, res) => {
    const runtime = deps.runtimeRegistry.list()[0]
    const commands = runtime?.getCommands() ?? []
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ commands }))
  })

  handlers.set('GET:/api/v1/tools', async (_req, res) => {
    const runtime = deps.runtimeRegistry.list()[0]
    const tools = runtime?.getTools() ?? []
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ tools }))
  })

  handlers.set('GET:/api/v1/skills', async (_req, res) => {
    const runtime = deps.runtimeRegistry.list()[0]
    const skills = runtime?.getSkills() ?? []
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ skills }))
  })

  handlers.set('POST:/api/v1/sessions/:id/commands', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing command', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }
    try {
      const { command, args } = JSON.parse(body)
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ accepted: true, command, args: args ?? [] }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })
}
