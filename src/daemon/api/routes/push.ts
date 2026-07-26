import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

interface StoredSubscription {
  id: string
  sessionId?: string
  subscription: PushSubscription
  createdAt: number
}

const subs = new Map<string, StoredSubscription>()

function readBody(body?: string): unknown {
  if (!body) return {}
  try { return JSON.parse(body) } catch { return {} }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

export function registerPushRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  _deps: ApiDependencies,
): void {
  handlers.set('POST:/api/v1/push/subscribe', async (_req, res, body) => {
    const data = readBody(body) as { endpoint: string; keys: { p256dh: string; auth: string }; sessionId?: string }
    if (!data.endpoint || !data.keys) {
      json(res, 400, { error: 'endpoint + keys required' })
      return
    }
    const id = `sub-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    subs.set(id, {
      id,
      sessionId: data.sessionId,
      subscription: { endpoint: data.endpoint, keys: data.keys },
      createdAt: Date.now(),
    })
    json(res, 200, { id, ok: true })
  })

  handlers.set('DELETE:/api/v1/push/subscribe/:id', async (req, res) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id
    if (!id || !subs.has(id)) {
      json(res, 404, { error: 'not found' })
      return
    }
    subs.delete(id)
    json(res, 200, { ok: true })
  })

  handlers.set('POST:/api/v1/push/send', async (_req, res, body) => {
    const data = readBody(body) as { sessionId?: string; title: string; body: string; url?: string }
    if (!data.title || !data.body) {
      json(res, 400, { error: 'title + body required' })
      return
    }
    let count = 0
    for (const sub of subs.values()) {
      if (data.sessionId && sub.sessionId !== data.sessionId) continue
      count++
    }
    json(res, 200, { sent: count, subs: subs.size, note: 'VAPID not configured — would require web-push setup' })
  })
}
