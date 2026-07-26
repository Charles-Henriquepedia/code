export type SessionState = 'idle' | 'running' | 'requires_action' | 'error'

export interface Session {
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

export interface SessionOptions {
  workspace?: string
  model?: string
  title?: string
  cwd?: string
}

export type MessageRole = 'user' | 'assistant' | 'system'

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ImageBlock {
  type: 'image'
  source: string
  mediaType?: string
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: unknown
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: string; text: string }>
  is_error?: boolean
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export interface RedactedThinkingBlock {
  type: 'redacted_thinking'
}

export type ContentBlock =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock
  | RedactedThinkingBlock

export interface BaseMessage {
  id: string
  role: MessageRole
  timestamp?: number
  type?: string
  subtype?: string
}

export interface UserMessage extends BaseMessage {
  role: 'user'
  content: ContentBlock[]
  isCompactSummary?: boolean
}

export interface AssistantMessage extends BaseMessage {
  role: 'assistant'
  content: ContentBlock[]
  model?: string
}

export interface SystemMessage extends BaseMessage {
  role: 'system'
  subtype?: string
  content?: ContentBlock[]
  text?: string
}

export type Message = UserMessage | AssistantMessage | SystemMessage

export type StreamEvent =
  | { type: 'system'; subtype?: string; [key: string]: unknown }
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown; is_error?: boolean }
  | { type: 'thinking'; thinking: string }
  | { type: 'message_start'; message: unknown }
  | { type: 'message_delta'; delta: unknown }
  | { type: 'message_stop' }
  | { type: 'content_block_start'; index: number; content_block: unknown }
  | { type: 'content_block_delta'; index: number; delta: unknown }
  | { type: 'content_block_stop'; index: number }
  | { type: 'error'; error: string }
  | Record<string, unknown>

export interface Command {
  name: string
  description: string
  aliases: string[]
  type: 'prompt' | 'local' | 'local-jsx'
  argumentHint?: string
  source: string
  hidden: boolean
  enabled: boolean
  examples: string[]
}

export interface Agent {
  name: string
  description: string
  color?: string
}

export interface ModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  contextWindow: number
  supportsThinking: boolean
}

export interface ToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  isReadOnly: boolean
  isConcurrencySafe: boolean
  isDestructive: boolean
}

export interface SkillInfo {
  name: string
  description: string
  source: string
  arguments: string[]
  examples: string[]
}

export interface Notification {
  id: string
  text: string
  level: 'immediate' | 'high' | 'medium' | 'low'
  content?: unknown
  dismissAfter?: number
}

export interface TokenInfo {
  url: string
  token: string
  pairedAt: number
}
