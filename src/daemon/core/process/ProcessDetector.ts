import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir } from 'node:os'

const execAsync = promisify(exec)

export interface AvailableProcess {
  pid: number
  sessionId: string | null
  cwd: string
  model: string | null
  startedAt: number
  cmdline: string
  attachable: boolean
}

const VERBOO_PATTERN = /verboo|claude(-code)?/

export class ProcessDetector {
  async listVerbooProcesses(): Promise<AvailableProcess[]> {
    if (process.platform === 'win32') {
      return this.listWindows()
    }
    if (process.platform === 'darwin' || process.platform === 'linux') {
      return this.listUnix()
    }
    return []
  }

  private async listUnix(): Promise<AvailableProcess[]> {
    try {
      const procs = process.platform === 'linux'
        ? await this.listLinuxProc()
        : await this.listMacPs()
      return procs.filter((p) => p.pid !== process.pid && VERBOO_PATTERN.test(p.cmdline))
    } catch {
      return []
    }
  }

  private async listLinuxProc(): Promise<AvailableProcess[]> {
    const pids = await readdir('/proc').catch(() => [])
    const procs: AvailableProcess[] = []

    for (const pidStr of pids) {
      const pid = parseInt(pidStr, 10)
      if (isNaN(pid) || pid === process.pid) continue

      try {
        const cmdline = await readFile(`/proc/${pid}/cmdline`, 'utf-8')
        const cmd = cmdline.replace(/\0/g, ' ').trim()
        if (!VERBOO_PATTERN.test(cmd)) continue

        const stat = await readFile(`/proc/${pid}/stat`, 'utf-8').catch(() => '')
        const startedAt = stat ? this.parseProcStatTime(stat) : Date.now()
        const cwd = await this.readLinkSafe(`/proc/${pid}/cwd`)

        procs.push({
          pid,
          sessionId: this.extractSessionId(cmd),
          cwd,
          model: this.extractModel(cmd),
          startedAt,
          cmdline: cmd,
          attachable: true,
        })
      } catch {
        continue
      }
    }

    return procs
  }

  private async listMacPs(): Promise<AvailableProcess[]> {
    const { stdout } = await execAsync('ps -eo pid,etime,command')
    const lines = stdout.trim().split('\n').slice(1)
    return lines
      .map((line) => this.parsePsLine(line))
      .filter((p): p is AvailableProcess => p !== null)
  }

  private async listWindows(): Promise<AvailableProcess[]> {
    try {
      const { stdout } = await execAsync(
        'wmic process where "CommandLine like \'%verboo%\' or CommandLine like \'%claude%\'" get ProcessId,CommandLine /format:csv',
      )
      const lines = stdout.trim().split('\n').filter((l) => l.trim())
      if (lines.length < 2) return []
      const header = lines[0]!.split(',')
      const pidIdx = header.indexOf('ProcessId')
      const cmdIdx = header.indexOf('CommandLine')
      const procs: AvailableProcess[] = []
      for (const line of lines.slice(1)) {
        const cols = line.split(',')
        const pid = parseInt(cols[pidIdx] ?? '', 10)
        const cmd = (cols[cmdIdx] ?? '').trim()
        if (isNaN(pid) || pid === process.pid) continue
        if (!VERBOO_PATTERN.test(cmd)) continue
        procs.push({
          pid,
          sessionId: this.extractSessionId(cmd),
          cwd: process.cwd(),
          model: this.extractModel(cmd),
          startedAt: Date.now(),
          cmdline: cmd,
          attachable: true,
        })
      }
      return procs
    } catch {
      return []
    }
  }

  private parsePsLine(line: string): AvailableProcess | null {
    const trimmed = line.trim()
    const pidMatch = trimmed.match(/^(\d+)\s+/)
    if (!pidMatch) return null
    const pid = parseInt(pidMatch[1]!, 10)
    if (pid === process.pid) return null
    const cmd = trimmed.slice(pidMatch[0].length).trim()
    if (!VERBOO_PATTERN.test(cmd)) return null
    return {
      pid,
      sessionId: this.extractSessionId(cmd),
      cwd: process.cwd(),
      model: this.extractModel(cmd),
      startedAt: Date.now(),
      cmdline: cmd,
      attachable: true,
    }
  }

  private parseProcStatTime(stat: string): number {
    try {
      const fields = stat.split(' ')
      const startTimeTicks = parseFloat(fields[fields.length - 1] ?? '0')
      const ticksPerSec = 100
      const bootTime = Date.now() - (process.uptime() * 1000)
      return Math.floor(bootTime + (startTimeTicks / ticksPerSec) * 1000)
    } catch {
      return Date.now()
    }
  }

  private async readLinkSafe(path: string): Promise<string> {
    try {
      const { readlink } = await import('node:fs/promises')
      return await readlink(path)
    } catch {
      return process.cwd()
    }
  }

  private extractSessionId(cmd: string): string | null {
    const match = cmd.match(/--session-id[=\s]+([a-f0-9-]+)/i)
    return match?.[1] ?? null
  }

  private extractModel(cmd: string): string | null {
    const match = cmd.match(/--model[=\s]+([^\s]+)/i)
    return match?.[1] ?? null
  }
}

export const processDetector = new ProcessDetector()
