export interface ToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  isReadOnly: boolean
  isConcurrencySafe: boolean
  isDestructive: boolean
}
