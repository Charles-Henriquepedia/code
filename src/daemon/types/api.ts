export interface HealthResponse {
  status: 'ok' | 'degraded' | 'error'
  uptime: number
  sessions: number
  version: string
  runtimes: string[]
}

export interface InfoResponse {
  version: string
  runtimes: string[]
  uptime: number
  daemonPid: number
  startedAt: string
}

export interface ApiError {
  error: string
  code: string
  statusCode: number
  details?: unknown
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
