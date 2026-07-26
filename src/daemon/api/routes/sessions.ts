import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

export function registerSessionRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/sessions', async (_req, res) => {
    const sessions = await deps.sessionManager.list()
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ sessions }))
  })

  handlers.set('POST:/api/v1/sessions', async (_req, res, body) => {
    try {
      const options = body ? JSON.parse(body) : {}
      const rtId = options.runtime ?? 'verboo'
      const session = await deps.sessionManager.create(rtId, {
        model: options.model,
        workspace: options.workspace,
        title: options.title,
      })
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ session }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })

  handlers.set('GET:/api/v1/sessions/:id', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    const session = await deps.sessionManager.get(id)
    if (!session) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found', code: 'NOT_FOUND', statusCode: 404 }))
      return
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ session }))
  })

  handlers.set('DELETE:/api/v1/sessions/:id', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    try {
      await deps.sessionManager.destroy(id)
      res.writeHead(204)
      res.end()
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found', code: 'NOT_FOUND', statusCode: 404 }))
    }
  })

  handlers.set('POST:/api/v1/sessions/:id/input', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing message body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }
    try {
      const { message } = JSON.parse(body)
      if (!message) throw new Error('message is required')
      res.writeHead(202, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ accepted: true }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })

  handlers.set('POST:/api/v1/sessions/:id/interrupt', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    const runtime = deps.runtimeRegistry.list()[0]
    if (runtime) await runtime.interruptSession(id)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ interrupted: true }))
  })

  handlers.set('POST:/api/v1/sessions/:id/model', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing model field', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }
    const { model } = JSON.parse(body)
    const session = await deps.sessionManager.get(id)
    if (session) {
      session.model = model
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ model }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found', code: 'NOT_FOUND', statusCode: 404 }))
    }
  })

  handlers.set('POST:/api/v1/sessions/:id/permission', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing mode field', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }
    const { mode } = JSON.parse(body)
    const valid = ['default', 'acceptEdits', 'plan', 'bypassPermissions']
    if (!valid.includes(mode)) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Invalid mode. Valid: ${valid.join(', ')}`, code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }
    const session = await deps.sessionManager.get(id)
    if (session) {
      session.setPermissionMode(mode)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ mode }))
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Session not found', code: 'NOT_FOUND', statusCode: 404 }))
    }
  })

  // Resume an existing CLI session by its transcript sessionId
  handlers.set('POST:/api/v1/sessions/:id/resume', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    try {
      const options = body ? JSON.parse(body) : {}
      const runtime = deps.runtimeRegistry.get('verboo')
      if (!runtime || typeof (runtime as { resumeCliSession?: unknown }).resumeCliSession !== 'function') {
        res.writeHead(500, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Verboo runtime does not support resume', code: 'INTERNAL', statusCode: 500 }))
        return
      }
      const result = await (runtime as unknown as {
        resumeCliSession: (sessionId: string, opts: { cwd?: string; model?: string }) => Promise<{ transcriptEntries?: unknown[] }>
      }).resumeCliSession(id, { cwd: options.cwd, model: options.model })
      const { transcriptEntries, ...sessionData } = result
      // Register the original Session instance (not the destructured plain object)
      // so methods like setPermissionMode are preserved
      await deps.sessionManager.register(result as any)
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ session: { ...sessionData, transcriptEntries } }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })

  // Get lock state for a session
  handlers.set('GET:/api/v1/sessions/:id/lock', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    const runtime = deps.runtimeRegistry.get('verboo') as { lockManager?: { getOwner: (id: string) => string | null; isLocked: (id: string) => boolean } } | undefined
    const owner = runtime?.lockManager?.getOwner(id) ?? null
    const locked = runtime?.lockManager?.isLocked(id) ?? false
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ sessionId: id, locked, owner }))
  })

  // Force-release a lock (admin override)
  handlers.set('DELETE:/api/v1/sessions/:id/lock', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    const runtime = deps.runtimeRegistry.get('verboo') as { lockManager?: { getOwner: (id: string) => string | null; release: (id: string, owner: string) => Promise<void> } } | undefined
    const owner = runtime?.lockManager?.getOwner(id) ?? null
    if (owner) {
      await runtime?.lockManager?.release(id, owner)
    }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ sessionId: id, released: !!owner }))
  })
}
