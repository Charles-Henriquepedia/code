import { readFile, writeFile, mkdir, open } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { existsSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { Daemon } from './Daemon.js'

const PID_DIR = join(homedir(), '.verboo', 'daemon')
const PID_PATH = join(PID_DIR, 'daemon.pid')
const LOG_PATH = join(PID_DIR, 'daemon.log')
const ERR_PATH = join(PID_DIR, 'daemon.err')

export class DaemonCLI {
  static async start(args: string[]): Promise<void> {
    const portIndex = args.indexOf('--port')
    const port = portIndex >= 0 ? parseInt(args[portIndex + 1], 10) : undefined
    const hostIndex = args.indexOf('--host')
    const host = hostIndex >= 0 ? args[hostIndex + 1] : undefined
    const foreground = args.includes('--foreground') || args.includes('-f')

    const existingPid = await DaemonCLI.getPid()
    if (existingPid) {
      try {
        process.kill(existingPid, 0)
        console.log(`Daemon already running (PID: ${existingPid})`)
        return
      } catch {
        await DaemonCLI.removeStalePid()
      }
    }

    if (foreground) {
      const daemon = new Daemon()
      await daemon.start(port, host)
      console.log(`Daemon started in foreground (PID: ${process.pid})`)
      return
    }

    await DaemonCLI.spawnDetached(port, host)
  }

  private static async spawnDetached(port?: number, host?: string): Promise<void> {
    await mkdir(PID_DIR, { recursive: true })

    const bunPath = process.execPath
    const scriptPath = join(import.meta.dirname ?? process.cwd(), '../entrypoint.ts')
    const args = ['start', '--foreground']
    if (port) args.push('--port', String(port))
    if (host) args.push('--host', host)

    const child = spawn(bunPath, [scriptPath, ...args], {
      detached: true,
      stdio: 'ignore',
      env: { ...process.env, DETACHED_DAEMON: '1' },
    })
    child.unref()

    // Give daemon time to write PID file
    let pid: number | null = null
    for (let i = 0; i < 15; i++) {
      await new Promise((r) => setTimeout(r, 200))
      pid = await DaemonCLI.getPid()
      if (pid) break
    }

    if (pid) {
      console.log(`Daemon started (PID: ${pid})`)
      console.log(`Stop: ${process.argv[0]} ${process.argv[1]} stop`)
      console.log(`Logs: tail -f ${LOG_PATH}`)
    } else {
      console.log('Daemon may not have started. Check:')
      console.log(`  tail -f ${LOG_PATH}`)
      console.log(`  tail -f ${ERR_PATH}`)
    }
  }

  static async stop(): Promise<void> {
    const pid = await DaemonCLI.getPid()
    if (!pid) {
      console.log('Daemon is not running')
      return
    }

    try {
      process.kill(pid, 'SIGTERM')
      console.log(`Stopped daemon (PID: ${pid})`)
      await DaemonCLI.removeStalePid()
    } catch {
      console.log('Daemon is not running')
      await DaemonCLI.removeStalePid()
    }
  }

  static async status(): Promise<void> {
    const pid = await DaemonCLI.getPid()
    if (!pid) {
      console.log('Daemon is not running')
      return
    }

    try {
      process.kill(pid, 0)
      console.log(`Daemon is running (PID: ${pid})`)
      console.log(`Logs: ${LOG_PATH}`)
    } catch {
      console.log('Daemon is not running (stale PID file)')
      await DaemonCLI.removeStalePid()
    }
  }

  static async logs(): Promise<void> {
    const { spawn: spawnCat } = await import('node:child_process')
    if (!existsSync(LOG_PATH)) {
      console.log('No logs yet')
      return
    }
    const tail = spawnCat('tail', ['-f', LOG_PATH], { stdio: 'inherit' })
    process.on('SIGINT', () => tail.kill())
    process.on('SIGTERM', () => tail.kill())
    await new Promise<void>((resolvePromise) => tail.once('exit', resolvePromise))
  }

  private static async getPid(): Promise<number | null> {
    try {
      const data = await readFile(PID_PATH, 'utf-8')
      const pid = parseInt(data.trim(), 10)
      return isNaN(pid) ? null : pid
    } catch {
      return null
    }
  }

  private static async removeStalePid(): Promise<void> {
    try {
      const { unlink } = await import('node:fs/promises')
      await unlink(PID_PATH)
    } catch {
      // ignore
    }
  }
}
