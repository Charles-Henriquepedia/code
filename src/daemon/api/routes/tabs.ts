import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'
import { processDetector } from '../../core/process/ProcessDetector.js'
import type { PtyRuntime, SpawnOptions } from '../../runtime/PtyRuntime.js'
import { existsSync } from 'node:fs'

export function registerTabRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  // GET /api/v1/tabs — listar todas as abas (ativas + disponíveis)
  handlers.set('GET:/api/v1/tabs', async (_req, res) => {
    const activeSessions = await deps.sessionManager.list()
    const available = await processDetector.listVerbooProcesses()

    // Filter out processes already managed by daemon
    const managedPids = new Set(activeSessions.map((s) => s.pid).filter(Boolean))
    const unattached = available.filter((p) => !managedPids.has(p.pid))

    const tabs = activeSessions.map((s) => ({
      id: s.id,
      type: 'sdk' as const,
      title: s.title ?? s.id.slice(0, 8),
      pid: s.pid,
      cwd: s.cwd,
      model: s.model,
      createdAt: s.createdAt,
      state: s.state,
    }))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ active: tabs, available: unattached }))
  })

  // GET /api/v1/processes — detectar processos Verboo
  handlers.set('GET:/api/v1/processes', async (_req, res) => {
    const activeSessions = await deps.sessionManager.list()
    const managedPids = new Set(activeSessions.map((s) => s.pid).filter(Boolean))
    const processes = (await processDetector.listVerbooProcesses())
      .filter((p) => !managedPids.has(p.pid))

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ processes }))
  })

  // POST /api/v1/tabs/spawn — spawnar novo PTY
  handlers.set('POST:/api/v1/tabs/spawn', async (_req, res, body) => {
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    try {
      const options = JSON.parse(body) as SpawnOptions

      if (!options.cwd || !existsSync(options.cwd)) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Invalid cwd: ${options.cwd}`, code: 'BAD_REQUEST', statusCode: 400 }))
        return
      }

      // Find PTY runtime
      const ptyRuntime = deps.runtimeRegistry.get('pty') as PtyRuntime | undefined
      if (!ptyRuntime) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'PTY runtime not available', code: 'NO_RUNTIME', statusCode: 503 }))
        return
      }

      const session = await ptyRuntime.spawnTerminal(options)
      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tab: {
          id: session.id,
          type: 'pty',
          title: options.title ?? session.id.slice(0, 8),
          pid: session.pid,
          cwd: options.cwd,
          model: options.model,
          createdAt: session.createdAt,
          state: session.state,
        },
      }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })

  // POST /api/v1/tabs/attach — attach a processo existente
  handlers.set('POST:/api/v1/tabs/attach', async (_req, res, body) => {
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    try {
      const { pid } = JSON.parse(body)
      if (!pid || typeof pid !== 'number') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'pid is required', code: 'BAD_REQUEST', statusCode: 400 }))
        return
      }

      const processes = await processDetector.listVerbooProcesses()
      const proc = processes.find((p) => p.pid === pid)
      if (!proc) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: `Process ${pid} not found or not a Verboo process`, code: 'NOT_FOUND', statusCode: 404 }))
        return
      }

      const verbooRuntime = deps.runtimeRegistry.get('verboo')
      if (!verbooRuntime) {
        res.writeHead(503, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Verboo runtime not available', code: 'NO_RUNTIME', statusCode: 503 }))
        return
      }

      // Create a monitoring session for the attached process
      const session = await verbooRuntime.createSession({
        cwd: proc.cwd,
        model: proc.model ?? 'sonnet',
        title: proc.cmdline.slice(0, 60),
      })

      res.writeHead(201, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        tab: {
          id: session.id,
          type: 'attach',
          title: proc.cmdline.slice(0, 40),
          pid: proc.pid,
          cwd: proc.cwd,
          model: proc.model,
          createdAt: session.createdAt,
          state: session.state,
        },
      }))
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: String(err), code: 'BAD_REQUEST', statusCode: 400 }))
    }
  })

  // PATCH /api/v1/tabs/:id — renomear tab
  handlers.set('PATCH:/api/v1/tabs/:id', async (req, res, body) => {
    const id = (req as unknown as { params?: Record<string, string> }).params?.id ?? ''
    if (!body) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing body', code: 'BAD_REQUEST', statusCode: 400 }))
      return
    }

    const { title } = JSON.parse(body)
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ id, title }))
  })

  // File system browser para path picker
  handlers.set('GET:/api/v1/fs/list', async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const path = url.searchParams.get('path') ?? process.cwd()

    try {
      const { readdir, stat } = await import('node:fs/promises')
      const entries = await readdir(path)

      const results: Array<{ name: string; type: string; isGit: boolean }> = []
      for (const name of entries) {
        if (name.startsWith('.')) continue
        try {
          const full = `${path}/${name}`
          const stats = await stat(full)
          const isGit = stats.isDirectory() && existsSync(`${full}/.git`)
          results.push({ name, type: stats.isDirectory() ? 'dir' : 'file', isGit: !!isGit })
        } catch {
          continue
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ path, parent: path.split('/').slice(0, -1).join('/') || '/', entries: results }))
    } catch {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: `Cannot list directory: ${path}`, code: 'NOT_FOUND', statusCode: 404 }))
    }
  })

  // GET /api/v1/fs/home
  handlers.set('GET:/api/v1/fs/home', async (_req, res) => {
    const { homedir } = await import('node:os')
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ path: homedir() }))
  })
}
