import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

const exec = promisify(execFile)

interface SearchHit {
  type: 'file' | 'session' | 'command'
  title: string
  subtitle?: string
  path?: string
  sessionId?: string
  line?: number
  preview?: string
}

async function runRg(query: string, cwd: string, maxResults = 20): Promise<SearchHit[]> {
  try {
    const { stdout } = await exec('rg', [
      '--no-heading',
      '--line-number',
      '--max-count', String(maxResults),
      '-i',
      query,
      cwd,
    ], { timeout: 5000, maxBuffer: 5 * 1024 * 1024 })
    return stdout.split('\n').filter(Boolean).slice(0, maxResults).map((line) => {
      const m = line.match(/^([^:]+):(\d+):(.*)$/)
      if (!m) return null
      return {
        type: 'file' as const,
        title: m[3]!.slice(0, 100),
        subtitle: `${m[1]}:${m[2]}`,
        path: join(cwd, m[1]!),
        line: parseInt(m[2]!, 10),
        preview: m[3]!.slice(0, 120),
      }
    }).filter(Boolean) as SearchHit[]
  } catch (err: unknown) {
    const e = err as { code?: number; stdout?: string }
    if (e.code === 1) return [] // rg exits 1 when no matches
    if (e.stdout) {
      return e.stdout.split('\n').filter(Boolean).slice(0, maxResults).map((line) => {
        const m = line.match(/^([^:]+):(\d+):(.*)$/)
        if (!m) return null
        return {
          type: 'file' as const,
          title: m[3]!.slice(0, 100),
          subtitle: `${m[1]}:${m[2]}`,
          path: join(cwd, m[1]!),
          line: parseInt(m[2]!, 10),
        }
      }).filter(Boolean) as SearchHit[]
    }
    return []
  }
}

async function searchSessions(query: string): Promise<SearchHit[]> {
  const projectsDir = join(homedir(), '.claude', 'projects')
  const hits: SearchHit[] = []
  try {
    const projects = await readdir(projectsDir).catch(() => [])
    for (const project of projects) {
      const dir = join(projectsDir, project)
      const files = await readdir(dir).catch(() => [])
      for (const f of files) {
        if (!f.endsWith('.jsonl')) continue
        const filePath = join(dir, f)
        const content = await readFile(filePath, 'utf-8').catch(() => '')
        const lines = content.split('\n')
        const sessionId = f.replace('.jsonl', '')
        let firstHit = -1
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]!.toLowerCase().includes(query.toLowerCase())) {
            firstHit = i
            break
          }
        }
        if (firstHit >= 0) {
          const previewLine = lines[firstHit]!.slice(0, 150)
          hits.push({
            type: 'session',
            title: project,
            subtitle: `${sessionId.slice(0, 8)} · line ${firstHit + 1}`,
            path: filePath,
            sessionId,
            line: firstHit + 1,
            preview: previewLine,
          })
          if (hits.length >= 10) return hits
        }
      }
    }
  } catch { /* ignore */ }
  return hits
}

function searchCommands(query: string, commands: Array<{ name: string; description: string }>): SearchHit[] {
  const q = query.toLowerCase()
  return commands
    .filter(c => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q))
    .slice(0, 8)
    .map(c => ({
      type: 'command' as const,
      title: `/${c.name}`,
      subtitle: c.description,
    }))
}

export function registerSearchRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/search', async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const q = url.searchParams.get('q') ?? ''
    const cwd = url.searchParams.get('cwd') ?? process.cwd()
    const scope = url.searchParams.get('scope') ?? 'all'

    if (!q || q.length < 2) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ hits: [] }))
      return
    }

    const results: { files: SearchHit[]; sessions: SearchHit[]; commands: SearchHit[] } = {
      files: [],
      sessions: [],
      commands: [],
    }

    const promises: Promise<void>[] = []
    if (scope === 'all' || scope === 'files') {
      promises.push(runRg(q, cwd).then(h => { results.files = h }))
    }
    if (scope === 'all' || scope === 'sessions') {
      promises.push(searchSessions(q).then(h => { results.sessions = h }))
    }
    if (scope === 'all' || scope === 'commands') {
      try {
        const { getCommands } = await import('../commands.js')
        const cmds = await getCommands()
        results.commands = searchCommands(q, cmds)
      } catch {
        const cmds = (deps as unknown as { commands: Array<{ name: string; description: string }> }).commands ?? []
        results.commands = searchCommands(q, cmds)
      }
    }

    await Promise.all(promises)

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ hits: results }))
  })
}
