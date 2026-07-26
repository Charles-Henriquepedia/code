export type SessionId = string & { readonly __brand: 'SessionId' }

export type SessionState = 'idle' | 'running' | 'requires_action' | 'error'

export interface Session {
  id: SessionId
  pid: number | null
  state: SessionState
  runtimeId: string
  model: string
  workspace: string
  cwd: string
  title: string | undefined
  createdAt: Date
  updatedAt: Date
  messageCount: number
  costUSD: number
}

export interface SessionSummary {
  id: SessionId
  state: SessionState
  model: string
  title: string | undefined
  createdAt: string
  runtimeId: string
  messageCount: number
}

export interface SessionOptions {
  workspace?: string
  model?: string
  title?: string
  cwd?: string
}
