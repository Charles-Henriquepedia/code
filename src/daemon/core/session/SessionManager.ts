import type { Session, SessionOptions, SessionSummary, SessionState } from '../../types/session.js'
import { RuntimeRegistry } from '../runtime/RuntimeRegistry.js'
import { SessionStore } from './SessionStore.js'
import { EventBus } from '../event/EventBus.js'

export class SessionManager {
  private sessions = new Map<string, Session>()
  private store: SessionStore
  public readonly events = new EventBus()

  constructor(
    private runtimeRegistry: RuntimeRegistry,
    store?: SessionStore,
  ) {
    this.store = store ?? new SessionStore()
  }

  async create(rtId: string, options: SessionOptions): Promise<Session> {
    const runtime = this.runtimeRegistry.get(rtId)
    if (!runtime) throw new Error(`Runtime not found: ${rtId}`)

    const session = await runtime.createSession(options)
    this.sessions.set(session.id, session)
    return session
  }

  async get(id: string): Promise<Session | undefined> {
    return this.sessions.get(id)
  }

  /** Register an externally-created session (e.g. from resumeCliSession) */
  async register(session: Session): Promise<void> {
    this.sessions.set(session.id, session)
  }

  async list(): Promise<Session[]> {
    return Array.from(this.sessions.values())
  }

  async destroy(id: string): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)

    const runtime = this.runtimeRegistry.get(session.runtimeId)
    if (runtime) {
      await runtime.destroySession(id).catch(() => {})
    }
    this.sessions.delete(id)
  }

  async updateState(id: string, state: SessionState): Promise<void> {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)
    session.state = state
    session.updatedAt = new Date()
    this.events.emit({
      type: 'session.state_changed',
      sessionId: id,
      state,
      timestamp: Date.now(),
    })
  }

  count(): number {
    return this.sessions.size
  }

  async restoreFromStore(): Promise<void> {
    const stored = await this.store.list()
    for (const s of stored) {
      const session: Session = {
        id: s.id as Session['id'],
        pid: s.pid,
        state: s.state,
        runtimeId: s.runtimeId,
        model: s.model,
        workspace: s.workspace,
        cwd: s.cwd,
        title: s.title,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
        messageCount: s.messageCount,
        costUSD: s.costUSD,
      }
      this.sessions.set(session.id, session)
    }
  }
}
