/**
 * RPC type definitions for the Verboo Daemon API.
 * All request/response types, SSE events, and WebSocket messages.
 */

// ─── Protocol version ───────────────────────────────────────────────
export const PROTOCOL_VERSION = '0.1.0'

// ─── Common types ───────────────────────────────────────────────────
export interface ApiError {
  error: string
  code: string
  statusCode: number
  details?: unknown
}

export interface SessionSummary {
  id: string
  runtimeId: string
  model: string
  workspace: string
  cwd: string
  title?: string
  permissionMode: string
  messageCount: number
  costUSD: number
  createdAt: string
  updatedAt?: string
}

export interface ContextUsage {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  costUSD: number
}

export interface TabInfo {
  id: string
  type: 'sdk' | 'pty' | 'attach'
  title: string
  pid?: number | null
  cwd?: string
  model?: string
  createdAt?: string
  state: string
}

export interface VerbooProcess {
  pid: number
  cmd: string
  cwd?: string
}

export interface CliSession {
  id: string
  project: string
  cwd: string | null
  filePath: string
  size: number
  modifiedAt: number
}

export interface FsEntry {
  name: string
  type: 'dir' | 'file'
  path: string
  isGit?: boolean
}

export interface SseEvent {
  event: string
  data: string
}

// ─── Health routes ──────────────────────────────────────────────────
// GET /api/v1/health
export interface HealthRequest {}
export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  uptime: number
  sessions: number
  version: string
  runtimes: string[]
}

// GET /api/v1/info
export interface InfoRequest {}
export interface InfoResponse {
  version: string
  protocolVersion: string
  runtimes: string[]
  uptime: number
  daemonPid: number
  startedAt: string
}

// ─── Session routes ─────────────────────────────────────────────────
// GET /api/v1/sessions
export interface ListSessionsRequest {}
export interface ListSessionsResponse {
  sessions: SessionSummary[]
}

// POST /api/v1/sessions
export interface CreateSessionRequest {
  runtime?: string
  model?: string
  workspace?: string
  title?: string
}
export interface CreateSessionResponse {
  session: SessionSummary
}

// GET /api/v1/sessions/:id
export interface GetSessionRequest {}
export interface GetSessionResponse {
  session: SessionSummary
}

// DELETE /api/v1/sessions/:id
export interface DeleteSessionRequest {}
export type DeleteSessionResponse = void // 204 No Content

// POST /api/v1/sessions/:id/input
export interface SendInputRequest {
  message: string
}
export interface SendInputResponse {
  accepted: true
}

// POST /api/v1/sessions/:id/interrupt
export interface InterruptRequest {}
export interface InterruptResponse {
  interrupted: true
}

// POST /api/v1/sessions/:id/model
export interface SetModelRequest {
  model: string
}
export interface SetModelResponse {
  model: string
}

// POST /api/v1/sessions/:id/permission
export interface SetPermissionRequest {
  mode: 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions'
}
export interface SetPermissionResponse {
  mode: string
}

// POST /api/v1/sessions/:id/resume
export interface ResumeRequest {
  cwd?: string
  model?: string
}
export interface ResumeResponse {
  session: SessionSummary & { transcriptEntries: unknown[] }
}

// GET /api/v1/sessions/:id/lock
export interface GetLockRequest {}
export interface GetLockResponse {
  sessionId: string
  locked: boolean
  owner: string | null
}

// DELETE /api/v1/sessions/:id/lock
export interface ReleaseLockRequest {}
export interface ReleaseLockResponse {
  sessionId: string
  released: boolean
}

// ─── Chat routes ────────────────────────────────────────────────────
// POST /api/v1/sessions/:id/chat  (SSE)
export interface ChatRequest {
  message: string
}
export type ChatSseEvent =
  | { event: 'start'; data: { sessionId: string } }
  | { event: 'stream_event'; data: { sessionId: string; event: unknown } }
  | { event: 'result'; data: { sessionId: string; result: unknown } }
  | { event: 'error'; data: { sessionId: string; error: string } }
  | { event: 'done'; data: { sessionId: string } }

// GET /api/v1/sessions/:id/messages
export interface GetMessagesRequest {}
export interface GetMessagesResponse {
  messages: unknown[]
}

// POST /api/v1/sessions/:id/command  (SSE)
export interface CommandRequest {
  command: string
  args?: string[]
}
export type CommandSseEvent =
  | { event: 'start'; data: { sessionId: string; command: string } }
  | { event: 'stream_event'; data: { sessionId: string; event: unknown } }
  | { event: 'error'; data: { error: string } }
  | { event: 'done'; data: { sessionId: string } }

// POST /api/v1/sessions/:id/commands  (fire-and-forget)
export interface SendCommandsRequest {
  command: string
  args?: string[]
}
export interface SendCommandsResponse {
  accepted: true
  command: string
  args: string[]
}

// ─── Command routes ─────────────────────────────────────────────────
// GET /api/v1/commands
export interface ListCommandsRequest {}
export interface ListCommandsResponse {
  commands: Array<{ name: string; description: string; args?: string[] }>
}

// GET /api/v1/tools
export interface ListToolsRequest {}
export interface ListToolsResponse {
  tools: Array<{ name: string; description: string }>
}

// GET /api/v1/skills
export interface ListSkillsRequest {}
export interface ListSkillsResponse {
  skills: Array<{ name: string; description: string }>
}

// ─── Model routes ───────────────────────────────────────────────────
// GET /api/v1/models
export interface ListModelsRequest {}
export interface ListModelsResponse {
  models: Array<{ id: string; name: string; provider: string }>
}

// ─── Tab routes ─────────────────────────────────────────────────────
// GET /api/v1/tabs
export interface ListTabsRequest {}
export interface ListTabsResponse {
  active: TabInfo[]
  available: VerbooProcess[]
}

// GET /api/v1/processes
export interface ListProcessesRequest {}
export interface ListProcessesResponse {
  processes: VerbooProcess[]
}

// POST /api/v1/tabs/spawn
export interface SpawnTabRequest {
  cwd: string
  title?: string
  model?: string
}
export interface SpawnTabResponse {
  tab: TabInfo
}

// POST /api/v1/tabs/attach
export interface AttachTabRequest {
  pid: number
}
export interface AttachTabResponse {
  tab: TabInfo
}

// PATCH /api/v1/tabs/:id
export interface UpdateTabRequest {
  title: string
}
export interface UpdateTabResponse {
  id: string
  title: string
}

// ─── Filesystem routes ──────────────────────────────────────────────
// GET /api/v1/fs/list
export interface FsListRequest {}
export interface FsListResponse {
  path: string
  parent: string
  entries: FsEntry[]
}

// GET /api/v1/fs/home
export interface FsHomeRequest {}
export interface FsHomeResponse {
  path: string
}

// ─── CLI session routes ─────────────────────────────────────────────
// GET /api/v1/cli-sessions
export interface ListCliSessionsRequest {}
export interface ListCliSessionsResponse {
  sessions: CliSession[]
}

// ─── WebSocket message types ────────────────────────────────────────
export type WsClientMessage =
  | { type: 'input'; message: string }
  | { type: 'interrupt' }
  | { type: 'pty_input'; data: string }
  | { type: 'pty_resize'; cols: number; rows: number }
  | { type: 'keep_alive' }

export type WsServerMessage =
  | { type: 'connected'; sessionId: string }
  | { type: 'stream_event'; sessionId: string; event: unknown }
  | { type: 'pty_output'; sessionId: string; data: string }
  | { type: 'transcript_append'; sessionId: string; entry: unknown }
  | { type: 'lock_acquired'; sessionId: string; owner: string }
  | { type: 'lock_released'; sessionId: string; owner: string }
  | { type: 'error'; error: string }
  | { type: 'interrupted'; sessionId: string }
