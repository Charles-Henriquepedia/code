import type { SessionState, SessionOptions } from '../../types/session.js'

export type SessionId = string & { readonly __brand: 'SessionId' }

export class Session {
  public readonly id: SessionId
  public readonly createdAt: Date = new Date()
  public state: SessionState = 'idle'
  public pid: number | null = null
  public runtimeId: string
  public model: string
  public workspace: string
  public cwd: string
  public title: string | undefined
  public permissionMode: string = 'acceptEdits'
  public updatedAt: Date = new Date()
  public messageCount: number = 0
  public costUSD: number = 0

  constructor(
    options: SessionOptions & { runtimeId: string; cwd: string },
  ) {
    this.id = crypto.randomUUID() as SessionId
    this.runtimeId = options.runtimeId
    this.model = options.model ?? 'sonnet'
    this.workspace = options.workspace ?? 'default'
    this.cwd = options.cwd
    this.title = options.title
  }

  updateState(state: SessionState): void {
    this.state = state
    this.updatedAt = new Date()
  }

  setPid(pid: number): void {
    this.pid = pid
  }

  setModel(model: string): void {
    this.model = model
    this.updatedAt = new Date()
  }

  setPermissionMode(mode: string): void {
    this.permissionMode = mode
    this.updatedAt = new Date()
  }

  incrementMessages(count: number = 1): void {
    this.messageCount += count
    this.updatedAt = new Date()
  }

  addCost(amount: number): void {
    this.costUSD += amount
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      pid: this.pid,
      state: this.state,
      runtimeId: this.runtimeId,
      model: this.model,
      workspace: this.workspace,
      cwd: this.cwd,
      title: this.title,
      permissionMode: this.permissionMode,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
      messageCount: this.messageCount,
      costUSD: this.costUSD,
    }
  }
}
