import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { readdir, stat, readFile } from 'node:fs/promises'

interface CliSession {
  id: string
  project: string
  cwd: string | null
  filePath: string
  size: number
  modifiedAt: number
}

async function readCwdFromTranscript(filePath: string): Promise<string | null> {
  try {
    const content = await readFile(filePath, { encoding: 'utf-8' })
    const lines = content.split('\n')
    // Scan first 20 lines for a cwd field (appears early in transcript)
    for (let i = 0; i < Math.min(lines.length, 20); i++) {
      const line = lines[i].trim()
      if (!line) continue
      try {
        const parsed = JSON.parse(line)
        if (parsed.cwd) return parsed.cwd
      } catch { /* skip unparseable */ }
    }
    return null
  } catch {
    return null
  }
}

async function listCliSessions(): Promise<CliSession[]> {
  const claudeProjectsDir = join(homedir(), '.claude', 'projects')
  const sessions: CliSession[] = []

  let projectDirs: string[]
  try {
    projectDirs = await readdir(claudeProjectsDir)
  } catch {
    return []
  }

  for (const projectDir of projectDirs) {
    const fullProjectPath = join(claudeProjectsDir, projectDir)
    let projectStat: Awaited<ReturnType<typeof stat>>
    try {
      projectStat = await stat(fullProjectPath)
    } catch {
      continue
    }
    if (!projectStat.isDirectory()) continue

    let files: string[]
    try {
      files = await readdir(fullProjectPath)
    } catch {
      continue
    }

    for (const file of files) {
      if (!file.endsWith('.jsonl')) continue
      const filePath = join(fullProjectPath, file)
      let fileStat: Awaited<ReturnType<typeof stat>>
      try {
        fileStat = await stat(filePath)
      } catch {
        continue
      }
      if (!fileStat.isFile()) continue

      // Read the cwd from the transcript's first entry for accuracy
      const cwd = await readCwdFromTranscript(filePath)
      const project = cwd
        ? cwd.split('/').pop() ?? cwd
        : projectDir.replace(/^-/, '').replace(/-/g, '/')

      sessions.push({
        id: file.replace(/\.jsonl$/, ''),
        project,
        cwd,
        filePath,
        size: fileStat.size,
        modifiedAt: fileStat.mtimeMs,
      })
    }
  }

  // Sort by most recently modified
  sessions.sort((a, b) => b.modifiedAt - a.modifiedAt)
  return sessions
}

export function registerCliSessionRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  _deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/cli-sessions', async (_req, res) => {
    try {
      const sessions = await listCliSessions()
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ sessions }))
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'INTERNAL', statusCode: 500 }))
    }
  })
}
