import type { ToolInfo } from './Tool.js'

export class ToolRegistry {
  private tools: ToolInfo[] = []
  private loaded = false

  async load(): Promise<void> {
    if (this.loaded) return
    try {
      const { getAllBaseTools } = await import('../../../tools.js')
      const verbooTools = getAllBaseTools()
      this.tools = []
      for (const rawTool of verbooTools) {
        try {
          const tool = rawTool as unknown as {
            name: string
            description?: (input?: unknown) => string | Promise<string>
            inputSchema?: Record<string, unknown>
            isReadOnly?: boolean
            isConcurrencySafe?: boolean
            isDestructive?: boolean
          }
          let description = ''
          try {
            description = await tool.description?.({} as never) ?? ''
          } catch {
            description = tool.name
          }
          this.tools.push({
            name: tool.name,
            description,
            inputSchema: (tool.inputSchema ?? {}) as Record<string, unknown>,
            isReadOnly: tool.isReadOnly ?? false,
            isConcurrencySafe: tool.isConcurrencySafe ?? false,
            isDestructive: tool.isDestructive ?? false,
          })
        } catch {
          // skip problematic tools
        }
      }
      this.loaded = true
    } catch {
      this.tools = []
    }
  }

  getAll(): ToolInfo[] {
    return this.tools
  }

  get(name: string): ToolInfo | undefined {
    return this.tools.find((t) => t.name === name)
  }

  getReadOnly(): ToolInfo[] {
    return this.tools.filter((t) => t.isReadOnly)
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
