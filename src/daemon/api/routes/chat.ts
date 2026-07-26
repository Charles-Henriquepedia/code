import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

export function registerChatRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  // POST /api/v1/sessions/:id/chat — envia mensagem, streama resposta SSE
  handlers.set('POST:/api/v1/sessions/:id/chat', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''

    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing message body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    let message: string
    try {
      const parsed = JSON.parse(body)
      if (!parsed.message || typeof parsed.message !== 'string') throw new Error()
      message = parsed.message
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid body: { "message": "<text>" }', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    const runtime = deps.runtimeRegistry.list()[0]
    if (!runtime) {
      res.writeHead(503, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'No runtime available', code: 'NO_RUNTIME', statusCode: 503 }))
      return
    }

    // SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    res.write(`event: start\ndata: ${JSON.stringify({ sessionId: id })}\n\n`)

    try {
      const stream = runtime.submitMessage(id, message)
      for await (const event of stream) {
        const payload = JSON.stringify({ sessionId: id, event })
        res.write(`event: stream_event\ndata: ${payload}\n\n`)
      }
    } catch (err) {
      const payload = JSON.stringify({ sessionId: id, error: String(err) })
      res.write(`event: error\ndata: ${payload}\n\n`)
    }

    res.write(`event: done\ndata: ${JSON.stringify({ sessionId: id })}\n\n`)
    res.end()
  })

  // GET /api/v1/sessions/:id/messages — histórico de mensagens
  handlers.set('GET:/api/v1/sessions/:id/messages', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    const session = await deps.sessionManager.get(id)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found', code: 'NOT_FOUND', statusCode: 404 }))
      return
    }

    const runtime = deps.runtimeRegistry.list()[0]
    const messages = runtime && 'getMessages' in runtime
      ? (runtime as { getMessages(id: string): unknown[] }).getMessages(id)
      : []

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ messages }))
  })

  // POST /api/v1/sessions/:id/command — executa slash command
  handlers.set('POST:/api/v1/sessions/:id/command', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''

    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing command body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    let command: string
    let args: string[] = []
    try {
      const parsed = JSON.parse(body)
      if (!parsed.command || typeof parsed.command !== 'string') throw new Error()
      command = parsed.command
      args = parsed.args ?? []
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid body: { "command": "<name>", "args": [] }', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    // SSE response for command execution
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    res.write(`event: start\ndata: ${JSON.stringify({ sessionId: id, command })}\n\n`)

    const runtime = deps.runtimeRegistry.list()[0]
    if (!runtime) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'No runtime available' })}\n\n`)
      res.write('event: done\ndata: {}\n\n')
      res.end()
      return
    }

    const cmdMsg = `/${command}${args.length ? ' ' + args.join(' ') : ''}`
    try {
      const stream = runtime.submitMessage(id, cmdMsg)
      for await (const event of stream) {
        const payload = JSON.stringify({ sessionId: id, event })
        res.write(`event: stream_event\ndata: ${payload}\n\n`)
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: String(err) })}\n\n`)
    }

    res.write(`event: done\ndata: ${JSON.stringify({ sessionId: id })}\n\n`)
    res.end()
  })
}
