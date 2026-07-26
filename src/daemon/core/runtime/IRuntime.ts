import type { StreamEvent } from '../../types/runtime.js'
import type { SessionState, SessionOptions, Session, SessionId } from '../../types/session.js'

export type { RuntimeConfig, ModelInfo, IRuntime, StreamEvent } from '../../types/runtime.js'
export type { Session, SessionOptions, SessionState } from '../../types/session.js'

export abstract class BaseRuntime {
  abstract readonly id: string
  abstract readonly name: string
  protected config!: import('../../types/runtime.js').RuntimeConfig

  abstract initialize(config: import('../../types/runtime.js').RuntimeConfig): Promise<void>
  abstract shutdown(): Promise<void>
  abstract createSession(options: SessionOptions): Promise<Session>
  abstract resumeSession(sessionId: string): Promise<Session>
  abstract destroySession(sessionId: string): Promise<void>
  abstract listSessions(): Promise<Session[]>

  abstract submitMessage(
    sessionId: string,
    message: string,
  ): AsyncGenerator<StreamEvent, void, undefined>

  abstract interruptSession(sessionId: string): Promise<void>

  abstract getCommands(): import('../command/Command.js').CommandInfo[]
  abstract getModels(): import('../../types/runtime.js').ModelInfo[]
  abstract getTools(): import('../tool/Tool.js').ToolInfo[]
  abstract getSkills(): import('../skill/SkillRegistry.js').SkillInfo[]
}
