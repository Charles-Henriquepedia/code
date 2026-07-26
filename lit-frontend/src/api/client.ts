import type { Session, Command, ModelInfo, StreamEvent } from '../types.js'

const DEFAULT_BASE_URL = ''

export class DaemonClient {
  private baseUrl: string
  private wsBaseUrl: string
  private ws: WebSocket | null = null
  private sessionId: string | null = null
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private shouldReconnect = true

  /** Per-session callbacks: keyed by sessionId */
  private streamCallbacks = new Map<string, (event: StreamEvent) => void>()
  /** Per-session transcript append callbacks */
  private transcriptCallbacks = new Map<string, (entry: unknown) => void>()

  /** Session state changes (WebSocket) */
  onStateChange: ((state: string) => void) | null = null
  /** Error handling */
  onError: ((err: string) => void) | null = null
  /** Lock changes (concurrency) */
  onLockChange: ((locked: boolean, owner: string | null) => void) | null = null

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl.replace(/\/$/, '')
    this.wsBaseUrl = this.baseUrl.replace(/^http/, 'ws')
  }

  setSessionId(id: string): void {
    this.sessionId = id
  }

  getSessionId(): string | null {
    return this.sessionId
  }

  /**
   * Register a callback for SSE events from a specific session.
   * Used by per-tab streaming so each tab gets its own events.
   */
  registerStreamCallback(sessionId: string, cb: (event: StreamEvent) => void): void {
    // Don't overwrite — preserves in-flight streaming callbacks
    if (!this.streamCallbacks.has(sessionId)) {
      this.streamCallbacks.set(sessionId, cb)
    }
  }

  unregisterStreamCallback(sessionId: string): void {
    this.streamCallbacks.delete(sessionId)
  }

  registerTranscriptCallback(sessionId: string, cb: (entry: unknown) => void): void {
    if (!this.transcriptCallbacks.has(sessionId)) {
      this.transcriptCallbacks.set(sessionId, cb)
    }
  }

  unregisterTranscriptCallback(sessionId: string): void {
    this.transcriptCallbacks.delete(sessionId)
  }

  /**
   * Switch the WebSocket to a different session (for multi-tab support).
   * Reconnects the WS with the new session_id.
   */
  switchSession(id: string): void {
    if (this.sessionId === id && this.ws?.readyState === WebSocket.OPEN) return
    this.sessionId = id
    this.reconnectAttempts = 0
    this.shouldReconnect = true
    this.connectWebSocket()
  }

  /* ───── HTTP REST ───── */

  async createSession(model = 'sonnet', title?: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, title }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { session: Session }
    this.sessionId = data.session.id
    return data.session
  }

  async getSession(id: string): Promise<Session> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions/${id}`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { session: Session }
    return data.session
  }

  async listSessions(): Promise<Session[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json() as { sessions: Session[] }
    return data.sessions
  }

  async destroySession(id: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/sessions/${id}`, { method: 'DELETE' })
  }

  async interrupt(): Promise<void> {
    if (!this.sessionId) return
    await fetch(`${this.baseUrl}/api/v1/sessions/${this.sessionId}/interrupt`, {
      method: 'POST',
    })
  }

  async setModel(sessionId: string, model: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    })
  }

  async setPermission(sessionId: string, mode: string): Promise<void> {
    await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}/permission`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode }),
    })
  }

  async getCommands(): Promise<Command[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/commands`)
    if (!res.ok) return []
    const data = await res.json() as { commands: Command[] }
    return data.commands ?? []
  }

  async getModels(): Promise<ModelInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/v1/models`)
    if (!res.ok) return []
    const data = await res.json() as { models: ModelInfo[] }
    return data.models ?? []
  }

  /* ───── SSE Chat ───── */

  /**
   * Envia mensagem via POST /chat e consome o SSE stream.
   * Roteia eventos para o callback registrado para a sessão (per-tab isolation).
   */
  async sendMessage(sessionId: string, message: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions/${sessionId}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status}: ${text}`)
    }

    // Consume SSE stream from response body
    const reader = res.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Parse SSE frames: event: <type>\ndata: <json>\n\n
      const frames = buffer.split('\n\n')
      buffer = frames.pop() ?? ''

      for (const frame of frames) {
        const lines = frame.split('\n')
        const eventType = lines.find((l) => l.startsWith('event: '))?.slice(7) ?? ''
        const dataLine = lines.find((l) => l.startsWith('data: '))
        if (!dataLine) continue

        // End-of-stream signal: emit result event for finalize
        if (eventType === 'done') {
          const cb = this.streamCallbacks.get(sessionId)
          cb?.({ type: 'result', subtype: 'done' } as StreamEvent)
          continue
        }

        try {
          const parsed = JSON.parse(dataLine.slice(6))
          const event = parsed.event ?? parsed
          // Route to the callback for this specific session (per-tab isolation)
          const cb = this.streamCallbacks.get(sessionId)
          cb?.(event as StreamEvent)
        } catch {
          // skip malformed
        }
      }
    }
  }

  /* ───── WebSocket (keep-alive, session state) ───── */

  connectWebSocket(): WebSocket {
    if (!this.sessionId) throw new Error('No active session')

    const url = `${this.wsBaseUrl}/api/v1/ws?session_id=${this.sessionId}`
    this.ws?.close()
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.reconnectAttempts = 0
    }

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data) as {
          type: string
          event?: StreamEvent
          state?: string
          error?: string
          entry?: unknown
          owner?: string | null
          sessionId?: string
        }
        const sid = data.sessionId ?? this.sessionId ?? ''
        switch (data.type) {
          case 'session_state':
            this.onStateChange?.(data.state ?? '')
            break
          case 'error':
            this.onError?.(data.error ?? 'Unknown WS error')
            break
          case 'stream_event':
            if (data.event) {
              const cb = this.streamCallbacks.get(sid)
              cb?.(data.event)
            }
            break
          case 'transcript_append': {
            const cb = this.transcriptCallbacks.get(sid)
            cb?.(data.entry)
            break
          }
          case 'lock_acquired':
            this.onLockChange?.(true, data.owner ?? null)
            break
          case 'lock_released':
            this.onLockChange?.(false, null)
            break
        }
      } catch {
        // skip
      }
    }

    this.ws.onclose = () => {
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        setTimeout(() => this.connectWebSocket(), Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000))
      }
    }

    return this.ws
  }

  sendKeepAlive(): void {
    this.ws?.send(JSON.stringify({ type: 'keep_alive' }))
  }

  disconnect(): void {
    this.shouldReconnect = false
    this.ws?.close()
    this.ws = null
  }
}
