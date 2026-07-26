import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

const exec = promisify(execFile)

async function runGit(
  args: string[],
  cwd: string,
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await exec('git', args, {
    cwd,
    timeout: 15000,
    maxBuffer: 10 * 1024 * 1024,
  })
  return { stdout, stderr }
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function getCwdFromQuery(req: IncomingMessage): string {
  const url = new URL(req.url ?? '/', 'http://localhost')
  return url.searchParams.get('cwd') ?? process.cwd()
}

function getBody(req: IncomingMessage, body?: string): unknown {
  if (body) {
    try { return JSON.parse(body) } catch { /* ignore */ }
  }
  return {}
}

export function registerGitRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  _deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/git/status', async (req, res) => {
    try {
      const cwd = getCwdFromQuery(req)
      const { stdout } = await runGit(
        ['status', '--porcelain', '-b', '--untracked-files=normal'],
        cwd,
      )
      const lines = stdout.split('\n').filter(Boolean)
      const branchLine = lines.shift() ?? ''
      const branchMatch = branchLine.match(/^## (.+?)(?:\.\.\.(.+?))?(?: \[(ahead (\d+))?(?:, )?(behind (\d+))?\])?$/)
      const branch = branchMatch?.[1] ?? 'unknown'
      const upstream = branchMatch?.[2]
      const ahead = parseInt(branchMatch?.[4] ?? '0', 10)
      const behind = parseInt(branchMatch?.[5] ?? '0', 10)

      const files = lines.map((l) => ({
        raw: l,
        staged: l[0],
        working: l[1],
        path: l.substring(3).trim(),
      }))

      json(res, 200, { branch, upstream, ahead, behind, files })
    } catch (err: unknown) {
      const e = err as Error & { code?: number }
      if (e.code === 128) {
        json(res, 200, { branch: null, upstream: null, ahead: 0, behind: 0, files: [], notice: 'Not a git repository' })
      } else {
        json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
      }
    }
  })

  handlers.set('GET:/api/v1/git/diff', async (req, res) => {
    try {
      const cwd = getCwdFromQuery(req)
      const url = new URL(req.url ?? '/', 'http://localhost')
      const file = url.searchParams.get('file') ?? ''
      const staged = url.searchParams.has('staged')
      const args = ['diff']
      if (staged) args.push('--cached')
      args.push('--unified=5', '--no-color')
      if (file) args.push('--', file)
      const { stdout } = await runGit(args, cwd)
      json(res, 200, { diff: stdout })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('GET:/api/v1/git/log', async (req, res) => {
    try {
      const cwd = getCwdFromQuery(req)
      const url = new URL(req.url ?? '/', 'http://localhost')
      const limit = parseInt(url.searchParams.get('limit') ?? '20', 10)
      const format = '%H|%h|%an|%ae|%ai|%s|%D'
      const { stdout } = await runGit(
        ['log', `--max-count=${limit}`, `--format=${format}`, '--no-color'],
        cwd,
      )
      const commits = stdout.split('\n').filter(Boolean).map((line) => {
        const parts = line.split('|')
        return {
          hash: parts[0] ?? '',
          shortHash: parts[1] ?? '',
          author: parts[2] ?? '',
          email: parts[3] ?? '',
          date: parts[4] ?? '',
          message: parts[5] ?? '',
          refs: parts[6] ?? '',
        }
      })
      json(res, 200, { commits })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('GET:/api/v1/git/branches', async (req, res) => {
    try {
      const cwd = getCwdFromQuery(req)
      const { stdout } = await runGit(
        ['branch', '--all', '--no-color', '--sort=-committerdate'],
        cwd,
      )
      const branches = stdout.split('\n').filter(Boolean).map((b) => ({
        name: b.replace('* ', '').trim(),
        current: b.startsWith('*'),
        remote: b.includes('remotes/'),
      }))
      json(res, 200, { branches })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/stage', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; files?: string[] }
      const cwd = b.cwd ?? process.cwd()
      const files = b.files ?? []
      const args = files.length > 0 ? ['add', ...files] : ['add', '-A']
      await runGit(args, cwd)
      json(res, 200, { ok: true })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/unstage', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; files?: string[] }
      const cwd = b.cwd ?? process.cwd()
      const files = b.files ?? []
      const args = files.length > 0 ? ['reset', 'HEAD', '--', ...files] : ['reset', 'HEAD']
      await runGit(args, cwd)
      json(res, 200, { ok: true })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/commit', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; message: string }
      const cwd = b.cwd ?? process.cwd()
      if (!b.message) {
        json(res, 400, { error: 'message is required', code: 'BAD_REQUEST', statusCode: 400 })
        return
      }
      const { stdout, stderr } = await runGit(['commit', '-m', b.message], cwd)
      json(res, 200, { ok: true, stdout, stderr })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/checkout', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; target: string; create?: boolean }
      const cwd = b.cwd ?? process.cwd()
      const args = ['checkout']
      if (b.create) args.push('-b')
      args.push(b.target)
      const { stdout } = await runGit(args, cwd)
      json(res, 200, { ok: true, stdout })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/fetch', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; remote?: string }
      const cwd = b.cwd ?? process.cwd()
      const args = ['fetch']
      if (b.remote) args.push(b.remote)
      const { stdout } = await runGit(args, cwd)
      json(res, 200, { ok: true, stdout })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/pull', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; remote?: string; branch?: string }
      const cwd = b.cwd ?? process.cwd()
      const args = ['pull', '--no-rebase']
      if (b.remote) args.push(b.remote)
      if (b.branch) args.push(b.branch)
      const { stdout } = await runGit(args, cwd)
      json(res, 200, { ok: true, stdout })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/push', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; remote?: string; branch?: string; force?: boolean }
      const cwd = b.cwd ?? process.cwd()
      const args = ['push']
      if (b.force) args.push('--force')
      if (b.remote) args.push(b.remote)
      if (b.branch) args.push(b.branch)
      const { stdout } = await runGit(args, cwd)
      json(res, 200, { ok: true, stdout })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })

  handlers.set('POST:/api/v1/git/merge', async (req, res, body) => {
    try {
      const b = (body ? JSON.parse(body) : {}) as { cwd?: string; branch: string }
      const cwd = b.cwd ?? process.cwd()
      const { stdout, stderr } = await runGit(['merge', b.branch, '--no-edit'], cwd)
      json(res, 200, { ok: true, stdout, stderr })
    } catch (err: unknown) {
      const e = err as Error
      json(res, 500, { error: e.message, code: 'GIT_ERROR', statusCode: 500 })
    }
  })
}
