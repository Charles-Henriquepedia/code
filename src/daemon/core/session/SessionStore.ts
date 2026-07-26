import { mkdir, readdir, readFile, writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { SessionState } from '../../types/session.js'

interface StoredSession {
  id: string
  pid: number | null
  state: SessionState
  runtimeId: string
  model: string
  workspace: string
  cwd: string
  title: string | undefined
  createdAt: string
  updatedAt: string
  messageCount: number
  costUSD: number
}

export class SessionStore {
  private dir: string

  constructor(baseDir?: string) {
    this.dir = baseDir ?? join(homedir(), '.verboo', 'daemon', 'sessions')
  }

  async save(session: StoredSession): Promise<void> {
    await mkdir(this.dir, { recursive: true })
    const path = this.getPath(session.id)
    await writeFile(path, JSON.stringify(session, null, 2), 'utf-8')
  }

  async load(id: string): Promise<StoredSession | null> {
    try {
      const data = await readFile(this.getPath(id), 'utf-8')
      return JSON.parse(data) as StoredSession
    } catch {
      return null
    }
  }

  async list(): Promise<StoredSession[]> {
    try {
      const files = await readdir(this.dir)
      const sessions: StoredSession[] = []
      for (const file of files) {
        if (!file.endsWith('.json')) continue
        try {
          const data = await readFile(join(this.dir, file), 'utf-8')
          sessions.push(JSON.parse(data) as StoredSession)
        } catch {
          continue
        }
      }
      return sessions.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    } catch {
      return []
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await unlink(this.getPath(id))
    } catch {
      // already deleted
    }
  }

  private getPath(id: string): string {
    return join(this.dir, `${id}.json`)
  }
}
