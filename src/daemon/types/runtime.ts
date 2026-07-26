export type StreamEvent = Record<string, unknown>

export interface RuntimeConfig {
  id: string
  name: string
  executablePath?: string
  env?: Record<string, string>
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  contextWindow: number
  supportsThinking: boolean
}

export interface IRuntime {
  readonly id: string
  readonly name: string

  initialize(config: RuntimeConfig): Promise<void>
  shutdown(): Promise<void>

  createSession(options: import('../types/session.js').SessionOptions): Promise<import('../types/session.js').Session>
  resumeSession(sessionId: string): Promise<import('../types/session.js').Session>
  destroySession(sessionId: string): Promise<void>
  listSessions(): Promise<import('../types/session.js').Session[]>

  submitMessage(
    sessionId: string,
    message: string,
  ): AsyncGenerator<StreamEvent, void, undefined>
  interruptSession(sessionId: string): Promise<void>

  getCommands(): import('../core/command/Command.js').CommandInfo[]
  getModels(): ModelInfo[]
  getTools(): import('../core/tool/Tool.js').ToolInfo[]
  getSkills(): import('../core/skill/SkillRegistry.js').SkillInfo[]
}
