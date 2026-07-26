export interface SkillInfo {
  name: string
  description: string
  source: string
  arguments: string[]
  examples: string[]
}

export class SkillRegistry {
  private skills: SkillInfo[] = []
  private loaded = false

  async load(cwd: string): Promise<void> {
    if (this.loaded) return
    try {
      const { getSkillToolCommands } = await import('../../../commands.js')
      const skillCommands = await getSkillToolCommands(cwd)
      this.skills = skillCommands.map((cmd) => ({
        name: cmd.name,
        description: cmd.description ?? '',
        source: 'source' in cmd ? (cmd.source as string) ?? 'builtin' : 'builtin',
        arguments: cmd.argumentHint ? [cmd.argumentHint] : [],
        examples: [],
      }))
    } catch (err) {
      console.warn('SkillRegistry: could not load skills:', (err as Error).message)
      this.skills = []
    }
    this.loaded = true
  }

  getAll(): SkillInfo[] {
    return this.skills
  }

  get(name: string): SkillInfo | undefined {
    return this.skills.find((s) => s.name === name)
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
