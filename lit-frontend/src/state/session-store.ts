import type { Session } from '../types.js'

class SessionStore {
  private session: Session | null = null
  private listeners = new Set<(s: Session | null) => void>()

  setSession(session: Session): void {
    this.session = session
    this.notify()
  }

  getSession(): Session | null {
    return this.session
  }

  clear(): void {
    this.session = null
    this.notify()
  }

  subscribe(listener: (s: Session | null) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.session)
    }
  }
}

export const sessionStore = new SessionStore()
