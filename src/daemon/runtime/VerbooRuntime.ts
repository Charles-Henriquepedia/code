import { BaseRuntime } from '../core/runtime/IRuntime.js'
import type { RuntimeConfig, ModelInfo } from '../types/runtime.js'
import type { Session, SessionOptions } from '../types/session.js'
import type { CommandInfo } from '../core/command/Command.js'
import type { ToolInfo } from '../core/tool/Tool.js'
import type { SkillInfo } from '../core/skill/SkillRegistry.js'
import type { StreamEvent } from '../types/runtime.js'
import { EventBus } from '../core/event/EventBus.js'
import { CommandRegistry } from '../core/command/CommandRegistry.js'
import { ToolRegistry } from '../core/tool/ToolRegistry.js'
import { SkillRegistry } from '../core/skill/SkillRegistry.js'
import { ModelManager } from '../core/model/ModelManager.js'
import { Session as SessionModel } from '../core/session/Session.js'
import { EventTypes } from '../core/event/EventTypes.js'
import type { SessionId } from '../core/session/Session.js'
import { TranscriptWatcher } from '../core/session/TranscriptWatcher.js'
import { SessionLockManager } from '../core/session/SessionLockManager.js'
import { resolveSessionFilePath } from '../../utils/sessionStoragePortable.js'

type SdkSessionHandle = {
  sendMessage(msg: string): Promise<{
    [Symbol.asyncIterator](): AsyncIterator<unknown>
  }>
  close(): Promise<void>
  interrupt(): Promise<void>
}

export class VerbooRuntime extends BaseRuntime {
  readonly id = 'verboo'
  readonly name = 'Verboo Code'

  public readonly events = new EventBus()
  public readonly commandRegistry = new CommandRegistry()
  public readonly toolRegistry = new ToolRegistry()
  public readonly skillRegistry = new SkillRegistry()
  public readonly modelManager = new ModelManager()

  private sessions = new Map<string, SessionModel>()
  private sdkSessions = new Map<string, SdkSessionHandle>()
  private cliPids = new Map<string, number>() // CLI PID per session for live-reload signal
  private messages = new Map<string, unknown[]>()
  private transcriptWatchers = new Map<string, TranscriptWatcher>()
  public readonly lockManager = new SessionLockManager()
  private initialized = false
  private cwd = process.cwd()

  async initialize(config: RuntimeConfig): Promise<void> {
    if (this.initialized) return
    this.config = config
    this.cwd = process.cwd()
    await this.commandRegistry.load(this.cwd)
    await this.toolRegistry.load()
    await this.skillRegistry.load(this.cwd)
    await this.modelManager.load()
    this.initialized = true
  }

  async shutdown(): Promise<void> {
    for (const session of this.sessions.values()) {
      await this.destroySession(session.id).catch(() => {})
    }
    this.sessions.clear()
    this.sdkSessions.clear()
    this.messages.clear()
    this.initialized = false
  }

  async createSession(options: SessionOptions): Promise<Session> {
    this.ensureInitialized()
    const session = new SessionModel({
      ...options,
      runtimeId: this.id,
      cwd: options.cwd ?? this.cwd,
    })
    this.sessions.set(session.id, session)
    this.messages.set(session.id, [])
    this.events.emit({ type: EventTypes.SESSION_CREATED as 'session.created', sessionId: session.id, timestamp: Date.now() })

    const { unstable_v2_createSession } = await import('../../entrypoints/sdk/v2.js')
    const sdkSession = await unstable_v2_createSession({
      cwd: options.cwd ?? this.cwd,
      model: options.model,
      sessionId: session.id,
      permissionMode: (session.permissionMode ?? 'acceptEdits') as 'acceptEdits',
      canUseTool: async () => ({ behavior: 'allow' as const }),
    })
    this.sdkSessions.set(session.id, sdkSession as unknown as SdkSessionHandle)

    return session
  }

  async resumeSession(sessionId: string): Promise<Session> {
    return this.resumeCliSession(sessionId, {})
  }

  async resumeCliSession(sessionId: string, options: { cwd?: string; model?: string }): Promise<Session & { transcriptEntries?: unknown[]; slug?: string }> {
    this.ensureInitialized()
    const cwd = options.cwd ?? this.cwd
    const model = options.model ?? 'ultra/glm-5.2'
    const session = new SessionModel({
      runtimeId: this.id,
      cwd,
      model,
    }) as Session & { transcriptEntries?: unknown[]; slug?: string }
    ;(session as { id: string }).id = sessionId
    this.messages.set(session.id, [])

    // Load existing transcript entries and include in response so frontend can display them
    const entries = await this.loadTranscriptHistory(sessionId, cwd)
    session.transcriptEntries = entries
    // Extract slug from first entry that has it (CLI-generated human-readable title)
    for (const entry of entries) {
      const e = entry as Record<string, unknown>
      if (typeof e.slug === 'string' && e.slug) {
        session.slug = e.slug
        break
      }
    }

    const { unstable_v2_resumeSession } = await import('../../entrypoints/sdk/v2.js')
    const sdkSession = await unstable_v2_resumeSession(sessionId, {
      cwd,
      model,
      permissionMode: 'acceptEdits',
      canUseTool: async () => ({ behavior: 'allow' as const }),
    })
    this.sdkSessions.set(session.id, sdkSession as unknown as SdkSessionHandle)

    this.sessions.set(session.id, session)

    // Start transcript watcher for live sync with CLI terminal
    await this.startTranscriptWatcher(sessionId, cwd)

    this.events.emit({ type: EventTypes.SESSION_CREATED as 'session.created', sessionId: session.id, timestamp: Date.now() })
    return session
  }

  private async loadTranscriptHistory(sessionId: string, cwd: string): Promise<unknown[]> {
    try {
      const { readFile } = await import('node:fs/promises')
      const resolved = await resolveSessionFilePath(sessionId, cwd)
      if (!resolved) return []
      const content = await readFile(resolved.filePath, { encoding: 'utf-8' })
      const entries: unknown[] = []
      const lines = content.split('\n').filter((l) => l.trim())
      for (const line of lines) {
        try {
          entries.push(JSON.parse(line))
        } catch {
          // skip malformed
        }
      }
      return entries
    } catch {
      return []
    }
  }

  private async startTranscriptWatcher(sessionId: string, cwd: string): Promise<void> {
    // Stop existing watcher if any
    this.stopTranscriptWatcher(sessionId)

    const resolved = await resolveSessionFilePath(sessionId, cwd)
    if (!resolved) return

    const watcher = new TranscriptWatcher(resolved.filePath)
    watcher.on('append', (entry) => {
      // CLI wrote to transcript - acquire lock on behalf of CLI if not already held
      const currentOwner = this.lockManager.getOwner(sessionId)
      if (!currentOwner) {
        // Try to find the CLI process pid from the entry (if available)
        const pid = (entry as { pid?: number })?.pid
        if (pid) this.cliPids.set(sessionId, pid)
        this.lockManager.acquire(sessionId, 'cli', pid).then((acquired) => {
          if (acquired) {
            this.events.emit({
              type: 'session.lock_acquired' as 'session.lock_acquired',
              sessionId,
              owner: 'cli',
              timestamp: Date.now(),
            })
          }
        }).catch(() => {})
      }

      this.events.emit({
        type: 'session.transcript_append' as 'session.transcript_append',
        sessionId,
        entry,
        timestamp: Date.now(),
      })
    })
    await watcher.start()
    this.transcriptWatchers.set(sessionId, watcher)
  }

  private stopTranscriptWatcher(sessionId: string): void {
    const watcher = this.transcriptWatchers.get(sessionId)
    if (watcher) {
      watcher.stop()
      this.transcriptWatchers.delete(sessionId)
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    const sdk = this.sdkSessions.get(sessionId)
    if (sdk) {
      await sdk.close().catch(() => {})
      this.sdkSessions.delete(sessionId)
    }
    this.stopTranscriptWatcher(sessionId)
    this.sessions.delete(sessionId)
    this.messages.delete(sessionId)
    this.events.emit({ type: EventTypes.SESSION_DESTROYED as 'session.destroyed', sessionId, reason: 'closed', timestamp: Date.now() })
  }

  async listSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values())
  }

  getMessages(sessionId: string): unknown[] {
    return this.messages.get(sessionId) ?? []
  }

  async *submitMessage(
    sessionId: string,
    message: string,
  ): AsyncGenerator<StreamEvent, void, undefined> {
    this.ensureInitialized()
    const session = this.sessions.get(sessionId)
    let sdkSession = this.sdkSessions.get(sessionId)

    if (!sdkSession) {
      const { unstable_v2_createSession } = await import('../../entrypoints/sdk/v2.js')
      sdkSession = await unstable_v2_createSession({
        cwd: this.cwd,
        permissionMode: (session?.permissionMode ?? 'acceptEdits') as 'acceptEdits',
        canUseTool: async () => ({ behavior: 'allow' as const }),
      }) as unknown as SdkSessionHandle
      this.sdkSessions.set(sessionId, sdkSession)
    }

    // Acquire lock on behalf of web before sending
    const acquired = await this.lockManager.acquire(sessionId, 'web', process.pid)
    if (!acquired) {
      const owner = this.lockManager.getOwner(sessionId)
      yield { type: 'error', error: `Session is locked by ${owner}. Wait for it to release.` } as StreamEvent
      return
    }
    this.events.emit({
      type: 'session.lock_acquired' as 'session.lock_acquired',
      sessionId,
      owner: 'web',
      timestamp: Date.now(),
    })

    if (session) session.updateState('running')

    try {
      const msgs = this.messages.get(sessionId) ?? []
      msgs.push({ role: 'user', content: message })

      const query = await sdkSession.sendMessage(message)
      const iter = query[Symbol.asyncIterator]()

      let done = false
      while (!done) {
        const result = await iter.next()
        done = !!result.done
        if (!done) {
          const event = result.value as StreamEvent
          msgs.push(event)
          yield event
        }
      }

      if (session) session.incrementMessages()
    } finally {
      // Release lock
      await this.lockManager.release(sessionId, 'web')
      this.events.emit({
        type: 'session.lock_released' as 'session.lock_released',
        sessionId,
        owner: 'web',
        timestamp: Date.now(),
      })
      if (session) session.updateState('idle')

      // Signal CLI process to reload transcript (live sync web→CLI)
      this.signalCliReload(sessionId)
    }
  }

  /**
   * Notify the CLI process that the transcript has been updated.
   * Writes a SIGWINCH + newline to the CLI's controlling TTY to trigger
   * an Ink re-render (which re-reads state but not the file).
   * More importantly, touches the JSONL file's parent dir to trigger
   * any OS-level inotify watches the CLI might have.
   */
  private signalCliReload(sessionId: string): void {
    const cliPid = this.cliPids.get(sessionId)
    if (!cliPid) return
    try {
      process.kill(cliPid, 0) // Check if alive
      // Send SIGWINCH — Node.js's Ink handles this and re-renders the UI,
      // which causes it to re-read session state (including transcript data
      // that the daemon may have updated in-memory via the SDK).
      process.kill(cliPid, 'SIGWINCH')
    } catch {
      this.cliPids.delete(sessionId)
    }
  }

  async interruptSession(sessionId: string): Promise<void> {
    const sdk = this.sdkSessions.get(sessionId)
    if (sdk) await sdk.interrupt().catch(() => {})
    const session = this.sessions.get(sessionId)
    if (session) session.updateState('idle')
  }

  getCommands(): CommandInfo[] {
    return this.commandRegistry.getEnabled()
  }

  getModels(): ModelInfo[] {
    return this.modelManager.getAll()
  }

  getTools(): ToolInfo[] {
    return this.toolRegistry.getAll()
  }

  getSkills(): SkillInfo[] {
    return this.skillRegistry.getAll()
  }

  private ensureInitialized(): void {
    if (!this.initialized) throw new Error('VerbooRuntime not initialized. Call initialize() first.')
  }
}

