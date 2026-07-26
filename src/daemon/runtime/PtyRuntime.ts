import { BaseRuntime } from '../core/runtime/IRuntime.js'
import type { RuntimeConfig, ModelInfo } from '../types/runtime.js'
import type { Session, SessionOptions } from '../types/session.js'
import type { CommandInfo } from '../core/command/Command.js'
import type { ToolInfo } from '../core/tool/Tool.js'
import type { SkillInfo } from '../core/skill/SkillRegistry.js'
import type { StreamEvent } from '../types/runtime.js'
import { EventBus } from '../core/event/EventBus.js'
import { EventTypes } from '../core/event/EventTypes.js'
import { Session as SessionModel } from '../core/session/Session.js'
import { PtyProcess } from '../core/process/PtyProcess.js'
import { randomUUID } from 'node:crypto'

type PtySession = SessionModel & {
  pty?: PtyProcess
  pid: number | null
  cwd: string
}

export interface SpawnOptions extends SessionOptions {
  cwd: string              // obrigatório
  cmd?: string             // default: 'verboo'
  args?: string[]
  cols?: number
  rows?: number
}

export class PtyRuntime extends BaseRuntime {
  readonly id = 'pty'
  readonly name = 'PTY Terminal'

  public readonly events = new EventBus()
  private sessions = new Map<string, PtySession>()
  private initialized = false
  private defaultCmd = 'bash'

  async initialize(_config: RuntimeConfig): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessions.values()) {
      session.pty?.kill()
    }
    this.sessions.clear()
    this.initialized = false
  }

  async spawnTerminal(options: SpawnOptions): Promise<Session> {
    this.ensureInitialized()
    if (!options.cwd) throw new Error('cwd is required for PTY spawn')

    const session = new SessionModel({
      runtimeId: this.id,
      cwd: options.cwd,
      model: options.model ?? 'sonnet',
      title: options.title,
      workspace: options.workspace,
    }) as PtySession

    const args: string[] = options.cmd === 'bash' || (!options.cmd && this.defaultCmd === 'bash')
      ? ['--login']
      : options.args ?? ['--print']
    if (options.model && options.cmd !== 'bash' && this.defaultCmd !== 'bash') {
      args.push('--model', options.model)
    }

    const pty = new PtyProcess({
      cwd: options.cwd,
      cmd: options.cmd ?? this.defaultCmd,
      args,
      cols: options.cols ?? 80,
      rows: options.rows ?? 24,
    })

    session.pty = pty
    session.pid = pty.pid

    pty.on('data', (data) => {
      this.events.emit({
        type: 'session.output' as never,
        sessionId: session.id,
        event: { type: 'output', data },
        timestamp: Date.now(),
      } as never)
    })

    pty.on('exit', (code) => {
      this.events.emit({
        type: 'session.stopped' as never,
        sessionId: session.id,
        reason: `exit code ${code}`,
        timestamp: Date.now(),
      } as never)
    })

    this.sessions.set(session.id, session)
    this.events.emit({ type: EventTypes.SESSION_CREATED as 'session.created', sessionId: session.id, timestamp: Date.now() })
    return session
  }

  async createSession(options: SessionOptions): Promise<Session> {
    return this.spawnTerminal({ ...options, cwd: options.cwd ?? process.cwd() })
  }

  async resumeSession(sessionId: string): Promise<Session> {
    const existing = this.sessions.get(sessionId)
    if (existing) return existing
    throw new Error(`PTY session ${sessionId} not found`)
  }

  async destroySession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.pty?.kill()
    this.sessions.delete(sessionId)
    this.events.emit({ type: EventTypes.SESSION_DESTROYED as 'session.destroyed', sessionId, reason: 'closed', timestamp: Date.now() })
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values())
  }

  writeToSession(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session?.pty) throw new Error(`Session ${sessionId} not found or no PTY`)
    session.pty.write(data)
  }

  resizeSession(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    session?.pty?.resize(cols, rows)
  }

  getSession(sessionId: string): PtySession | undefined {
    return this.sessions.get(sessionId)
  }

  async *submitMessage(sessionId: string, message: string): AsyncGenerator<StreamEvent, void, undefined> {
    this.writeToSession(sessionId, message + '\n')
    // PTY sessions don't yield events synchronously - output comes via EventEmitter
    // Frontend must subscribe via WebSocket for real-time output
    return
  }

  async interruptSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId)
    if (session?.pty) {
      session.pty.write('\x03') // Ctrl+C
    }
  }

  getCommands(): CommandInfo[] { return [] }
  getModels(): ModelInfo[] { return [] }
  getTools(): ToolInfo[] { return [] }
  getSkills(): SkillInfo[] { return [] }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('PtyRuntime not initialized')
  }
}
