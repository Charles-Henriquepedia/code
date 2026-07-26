import { existsSync } from 'node:fs'
import { realpath } from 'node:fs/promises'
import { resolve, relative } from 'node:path'

export interface WorkspaceInfo {
  path: string
  name: string
  isGitRepo: boolean
  gitRoot: string | null
}

export class WorkspaceManager {
  private workspaces = new Map<string, WorkspaceInfo>()

  async resolve(cwd: string): Promise<WorkspaceInfo> {
    const cached = this.workspaces.get(cwd)
    if (cached) return cached

    const absPath = resolve(cwd)
    const gitRoot = await this.findGitRoot(absPath)
    const info: WorkspaceInfo = {
      path: absPath,
      name: gitRoot ? relative('/', gitRoot) : absPath.split('/').pop() ?? 'unknown',
      isGitRepo: gitRoot !== null,
      gitRoot,
    }
    this.workspaces.set(cwd, info)
    return info
  }

  async findGitRoot(dir: string): Promise<string | null> {
    try {
      const { execSync } = await import('node:child_process')
      const root = execSync('git rev-parse --show-toplevel', {
        cwd: dir,
        encoding: 'utf-8',
        timeout: 5000,
      }).trim()
      return root || null
    } catch {
      if (dir === '/') return null
      const parent = dir.split('/').slice(0, -1).join('/') || '/'
      return this.findGitRoot(parent)
    }
  }

  clearCache(): void {
    this.workspaces.clear()
  }
}
