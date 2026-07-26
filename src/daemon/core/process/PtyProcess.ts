import { spawn, type ChildProcess } from 'node:child_process'
import { EventEmitter } from 'node:events'
import { existsSync, statSync } from 'node:fs'

export interface PtyOptions {
  cwd: string
  cmd: string
  args?: string[]
  env?: Record<string, string>
  cols?: number
  rows?: number
}

export interface PtyProcessEvents {
  data: (data: string) => void
  exit: (code: number | null, signal: NodeJS.Signals | null) => void
  error: (err: Error) => void
}

export class PtyProcess extends EventEmitter {
  public readonly pid: number
  public readonly cwd: string
  public readonly cmd: string
  private child: ChildProcess
  private exited = false

  constructor(options: PtyOptions) {
    super()
    this.cwd = this.validateCwd(options.cwd)
    this.cmd = options.cmd

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      ...options.env,
      // Tell Verboo CLI it's running under daemon control
      VERBOO_DAEMON_CHILD: '1',
    }

    // Use `script` command to allocate a real PTY (bash needs TTY for prompt)
    const scriptArgs = ['-q', '-c', `${options.cmd} ${(options.args ?? []).join(' ')}`, '/dev/null']
    this.child = spawn('script', scriptArgs, {
      cwd: this.cwd,
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
    })

    this.pid = this.child.pid!

    this.child.stdout?.on('data', (chunk: Buffer) => {
      this.emit('data', chunk.toString('utf-8'))
    })

    this.child.stderr?.on('data', (chunk: Buffer) => {
      this.emit('data', `\x1b[31m${chunk.toString('utf-8')}\x1b[0m`)
    })

    this.child.on('error', (err) => {
      this.emit('error', err)
    })

    this.child.on('exit', (code, signal) => {
      this.exited = true
      this.emit('exit', code, signal)
    })
  }

  write(data: string): void {
    if (this.exited) return
    this.child.stdin?.write(data)
  }

  resize(_cols: number, _rows: number): void {
    // node-pty supports resize; child_process doesn't (SIGWINCH is sent to tty)
    // For child_process pipe mode, we can't resize; we'd need node-pty
    // Sending resize event is handled at higher level
  }

  kill(signal: NodeJS.Signals = 'SIGTERM'): void {
    if (this.exited) return
    try {
      this.child.kill(signal)
    } catch {
      // already dead
    }
  }

  isExited(): boolean {
    return this.exited
  }

  private validateCwd(cwd: string): string {
    if (!existsSync(cwd)) {
      throw new Error(`Working directory does not exist: ${cwd}`)
    }
    const stat = statSync(cwd)
    if (!stat.isDirectory()) {
      throw new Error(`Working directory is not a directory: ${cwd}`)
    }
    return cwd
  }
}
