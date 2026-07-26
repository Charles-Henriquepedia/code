/**
 * PTY Relay for Monitor Server
 *
 * Spawns terminal processes and relays I/O via WebSocket.
 * Uses child_process.spawn as fallback when node-pty is unavailable.
 */

import type { WebSocket } from 'ws'
import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'

export interface PtySession {
  id: string
  process: ChildProcess
  ws: WebSocket
  createdAt: number
}

export class PtyRelay extends EventEmitter {
  private sessions = new Map<string, PtySession>()
  private maxSessions = 10

  /**
   * Create a new PTY session and connect it to a WebSocket.
   */
  createSession(ws: WebSocket, options: {
    sessionId?: string
    shell?: string
    cols?: number
    rows?: number
    cwd?: string
    env?: Record<string, string>
  } = {}): string {
    const sessionId = options.sessionId || `pty-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    // Check session limit
    if (this.sessions.size >= this.maxSessions) {
      const oldest = Array.from(this.sessions.values())
        .sort((a, b) => a.createdAt - b.createdAt)[0]
      if (oldest) {
        this.destroySession(oldest.id)
      }
    }

    const shell = options.shell || process.env.SHELL || '/bin/bash'
    const cwd = options.cwd || process.env.HOME || '/tmp'
    const env = { ...process.env, TERM: 'xterm-256color', ...options.env }

    // Use 'script' command to create a pseudo-TTY for better shell compatibility
    const childProcess = spawn('script', ['-q', '-c', shell, '/dev/null'], {
      cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    const session: PtySession = {
      id: sessionId,
      process: childProcess,
      ws,
      createdAt: Date.now(),
    }

    this.sessions.set(sessionId, session)

    // Forward stdout to WebSocket
    if (childProcess.stdout) {
      childProcess.stdout.on('data', (data: Buffer) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'stream_event',
              sessionId,
              event: { type: 'output', data: data.toString('utf8') },
            }))
          } catch { /* ignore */ }
        }
      })
    }

    // Forward stderr to WebSocket
    if (childProcess.stderr) {
      childProcess.stderr.on('data', (data: Buffer) => {
        if (ws.readyState === ws.OPEN) {
          try {
            ws.send(JSON.stringify({
              type: 'stream_event',
              sessionId,
              event: { type: 'output', data: data.toString('utf8') },
            }))
          } catch { /* ignore */ }
        }
      })
    }

    // Handle process exit
    childProcess.on('exit', (code) => {
      this.sessions.delete(sessionId)
      if (ws.readyState === ws.OPEN) {
        try {
          ws.send(JSON.stringify({
            type: 'session_state',
            sessionId,
            state: 'stopped',
            exitCode: code,
          }))
        } catch { /* ignore */ }
      }
      this.emit('exit', sessionId, code)
    })

    // Send session started message
    if (ws.readyState === ws.OPEN) {
      try {
        ws.send(JSON.stringify({
          type: 'session_state',
          sessionId,
          state: 'running',
        }))
      } catch { /* ignore */ }
    }

    return sessionId
  }

  /**
   * Send input to a session.
   */
  writeInput(sessionId: string, data: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    try {
      if (session.process.stdin) {
        session.process.stdin.write(data)
      }
      return true
    } catch {
      return false
    }
  }

  /**
   * Resize a session (no-op for child_process, only works with real PTY).
   */
  resize(sessionId: string, cols: number, rows: number): boolean {
    // child_process doesn't support resize, this is a no-op
    return this.sessions.has(sessionId)
  }

  /**
   * Destroy a session.
   */
  destroySession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId)
    if (!session) return false

    try {
      session.process.kill('SIGTERM')
    } catch { /* ignore */ }

    this.sessions.delete(sessionId)
    return true
  }

  /**
   * Destroy all sessions.
   */
  destroyAll(): void {
    for (const [id] of this.sessions) {
      this.destroySession(id)
    }
  }

  /**
   * Get session info.
   */
  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * List all sessions.
   */
  listSessions(): Array<{ id: string; createdAt: number }> {
    return Array.from(this.sessions.values()).map(s => ({
      id: s.id,
      createdAt: s.createdAt,
    }))
  }
}

// Singleton instance
export const ptyRelay = new PtyRelay()
