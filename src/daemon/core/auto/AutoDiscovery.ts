import { readdir, stat } from 'node:fs/promises'
import { join, basename, extname } from 'node:path'

export interface DiscoveredModule {
  name: string
  path: string
  type: 'command' | 'runtime' | 'skill' | 'tool'
  priority: number
}

export class AutoDiscovery {
  private discovered = new Map<string, DiscoveredModule>()

  async scanDir(dir: string, type: DiscoveredModule['type']): Promise<DiscoveredModule[]> {
    const modules: DiscoveredModule[] = []
    try {
      const entries = await readdir(dir)
      for (const entry of entries) {
        const fullPath = join(dir, entry)
        const stats = await stat(fullPath)
        if (stats.isFile() && (entry.endsWith('.ts') || entry.endsWith('.js')) && !entry.endsWith('.test.ts')) {
          const name = basename(entry, extname(entry))
          modules.push({ name, path: fullPath, type, priority: 0 })
        }
      }
    } catch {
      // directory doesn't exist
    }
    for (const mod of modules) {
      this.discovered.set(`${type}:${mod.name}`, mod)
    }
    return modules
  }

  async scan(coreDir: string): Promise<{
    commands: DiscoveredModule[]
    runtimes: DiscoveredModule[]
  }> {
    const commands = await this.scanDir(join(coreDir, 'commands'), 'command')
    const runtimes = await this.scanDir(join(coreDir, 'runtime'), 'runtime')
    return { commands, runtimes }
  }

  getDiscovered(): DiscoveredModule[] {
    return Array.from(this.discovered.values())
  }

  clear(): void {
    this.discovered.clear()
  }
}
