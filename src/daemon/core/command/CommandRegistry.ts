import type { CommandInfo } from './Command.js'

export class CommandRegistry {
  private commands: CommandInfo[] = []
  private loaded = false

  async load(cwd: string): Promise<void> {
    if (this.loaded) return
    try {
      const { getCommands } = await import('../../../commands.js')
      const verbooCommands = await getCommands(cwd)
      this.commands = verbooCommands.map((cmd: unknown) => {
        const c = cmd as {
          name: string
          description?: string
          aliases?: string[]
          type?: string
          argumentHint?: string
          source?: string
          hidden?: boolean
        }
        return {
          name: c.name,
          description: c.description ?? '',
          aliases: c.aliases ?? [],
          type: (c.type ?? 'local') as CommandInfo['type'],
          argumentHint: c.argumentHint,
          source: c.source ?? 'builtin',
          hidden: c.hidden ?? false,
          enabled: true,
          examples: [],
        }
      })
    } catch (err) {
      console.warn('CommandRegistry: could not load Verboo commands (config not initialized):', (err as Error).message)
      this.commands = []
    }
    this.loaded = true
  }

  getAll(): CommandInfo[] {
    return this.commands
  }

  get(name: string): CommandInfo | undefined {
    return this.commands.find(
      (c) => c.name === name || c.aliases.includes(name),
    )
  }

  findByAlias(alias: string): CommandInfo | undefined {
    return this.commands.find((c) => c.aliases.includes(alias))
  }

  getEnabled(): CommandInfo[] {
    return this.commands.filter((c) => c.enabled)
  }

  reload(commands: CommandInfo[]): void {
    this.commands = commands
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
