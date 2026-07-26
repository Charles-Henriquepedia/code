import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { EventEmitter } from 'node:events'

export type LockOwner = 'cli' | 'web'

interface LockState {
  owner: LockOwner
  acquiredAt: number
  pid?: number
}

/**
 * Manages per-session locks to coordinate CLI terminal and web frontend.
 *
 * Only one client (CLI or web) can hold the lock at a time. The lock holder
 * is allowed to send messages. Other clients receive a "locked" notification
 * and must wait for the lock to be released.
 *
 * Lock state is persisted to ~/.verboo/session-locks/<sessionId>.json so that
 * a CLI process crash doesn't leave a stale lock (we check pid liveness).
 */
export class SessionLockManager extends EventEmitter {
  private lockDir: string
  private locks = new Map<string, LockState>()

  constructor(baseDir?: string) {
    super()
    this.lockDir = baseDir ?? join(homedir(), '.verboo', 'session-locks')
  }

  async acquire(sessionId: string, owner: LockOwner, pid?: number): Promise<boolean> {
    // Check in-memory lock first
    const existing = this.locks.get(sessionId)
    if (existing) {
      // If same owner, allow re-acquire (idempotent)
      if (existing.owner === owner) return true
      // If CLI lock and CLI process is dead, release it
      if (existing.owner === 'cli' && existing.pid && !this.isPidAlive(existing.pid)) {
        await this.release(sessionId, existing.owner)
      } else {
        return false
      }
    }

    // Check persisted lock (in case daemon restarted)
    const persisted = await this.readLock(sessionId)
    if (persisted) {
      if (persisted.owner === owner) {
        this.locks.set(sessionId, persisted)
        return true
      }
      if (persisted.owner === 'cli' && persisted.pid && !this.isPidAlive(persisted.pid)) {
        await this.release(sessionId, persisted.owner)
      } else if (persisted.owner === 'web') {
        // Web locks are in-memory only; if daemon restarted, they're stale
        await this.release(sessionId, persisted.owner)
      } else {
        return false
      }
    }

    // Acquire
    const state: LockState = { owner, acquiredAt: Date.now(), pid }
    this.locks.set(sessionId, state)
    await this.writeLock(sessionId, state)
    this.emit('acquired', { sessionId, owner })
    return true
  }

  async release(sessionId: string, owner: LockOwner): Promise<void> {
    const existing = this.locks.get(sessionId)
    if (existing && existing.owner === owner) {
      this.locks.delete(sessionId)
      await this.deleteLock(sessionId)
      this.emit('released', { sessionId, owner })
    }
  }

  getOwner(sessionId: string): LockOwner | null {
    return this.locks.get(sessionId)?.owner ?? null
  }

  isLocked(sessionId: string): boolean {
    return this.locks.has(sessionId)
  }

  private isPidAlive(pid: number): boolean {
    try {
      process.kill(pid, 0)
      return true
    } catch {
      return false
    }
  }

  private async writeLock(sessionId: string, state: LockState): Promise<void> {
    try {
      await mkdir(this.lockDir, { recursive: true })
      await writeFile(join(this.lockDir, `${sessionId}.json`), JSON.stringify(state), 'utf-8')
    } catch {
      // best-effort persistence
    }
  }

  private async readLock(sessionId: string): Promise<LockState | null> {
    const path = join(this.lockDir, `${sessionId}.json`)
    if (!existsSync(path)) return null
    try {
      const data = await readFile(path, 'utf-8')
      return JSON.parse(data) as LockState
    } catch {
      return null
    }
  }

  private async deleteLock(sessionId: string): Promise<void> {
    try {
      await unlink(join(this.lockDir, `${sessionId}.json`))
    } catch {
      // ignore
    }
  }
}
