import { writeFile, readFile, unlink, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { RuntimeRegistry } from '../core/runtime/RuntimeRegistry.js'
import { SessionManager } from '../core/session/SessionManager.js'
import { ConfigService } from '../core/config/ConfigService.js'
import { EventBus } from '../core/event/EventBus.js'
import { HttpServer } from '../api/server/HttpServer.js'
import { VerbooRuntime } from '../runtime/VerbooRuntime.js'
import { EventTypes } from '../core/event/EventTypes.js'

export class Daemon {
  public readonly events = new EventBus()
  public readonly runtimeRegistry = new RuntimeRegistry()
  public readonly configService = new ConfigService()
  public readonly sessionManager = new SessionManager(this.runtimeRegistry)
  public httpServer!: HttpServer

  private startedAt = Date.now()
  private running = false
  private pidDir: string

  constructor(baseDir?: string) {
    this.pidDir = baseDir ?? join(homedir(), '.verboo', 'daemon')
  }

  async start(port?: number, host?: string): Promise<void> {
    if (this.running) return

    // Define MACRO globals needed by Verboo SDK before any imports
    ;(globalThis as Record<string, unknown>).MACRO = {
      VERSION: '0.14.4',
      DISPLAY_VERSION: '0.14.4',
      BUILD_TIME: new Date().toISOString(),
      FEEDBACK_CHANNEL: 'https://github.com/verbeux-ai/code/issues',
    }

    this.events.emit({ type: EventTypes.DAEMON_STARTING as 'daemon.starting', pid: process.pid, timestamp: Date.now() })

    try {
      const { enableConfigs } = await import('../../utils/config.js')
      enableConfigs()
    } catch (err) {
      console.warn('Could not enable Verboo configs:', (err as Error).message)
    }

    const config = await this.configService.load()
    const listenPort = port ?? config.port
    const listenHost = host ?? config.host

    const verbooRuntime = new VerbooRuntime()
    this.runtimeRegistry.register(verbooRuntime)

    // Inject Verboo auth token into ModelManager if available
    const oauthToken = process.env.CLAUDE_CODE_OAUTH_TOKEN
    if (oauthToken) {
      const { setModelToken } = await import('../core/model/ModelManager.js')
      setModelToken(oauthToken)
    }

    const { PtyRuntime } = await import('../runtime/PtyRuntime.js')
    const ptyRuntime = new PtyRuntime()
    this.runtimeRegistry.register(ptyRuntime)

    await this.runtimeRegistry.initializeAll([
      { id: 'verboo', name: 'Verboo Code' },
      { id: 'pty', name: 'PTY Terminal' },
    ])

    await this.writePidFile()

    this.httpServer = new HttpServer({
      runtimeRegistry: this.runtimeRegistry,
      sessionManager: this.sessionManager,
      configService: this.configService,
      eventBus: this.events,
    })

    await this.httpServer.start(listenPort, listenHost)
    this.running = true

    this.events.emit({
      type: EventTypes.DAEMON_STARTED as 'daemon.started',
      pid: process.pid,
      port: listenPort,
      timestamp: Date.now(),
    })

    this.setupSignalHandlers()
  }

  async stop(): Promise<void> {
    if (!this.running) return
    this.running = false

    this.events.emit({ type: EventTypes.DAEMON_STOPPING as 'daemon.stopping', reason: 'shutdown', timestamp: Date.now() })

    await this.httpServer.stop().catch(() => {})
    await this.runtimeRegistry.shutdownAll().catch(() => {})
    await this.removePidFile().catch(() => {})

    process.exit(0)
  }

  isRunning(): boolean {
    return this.running
  }

  getUptime(): number {
    return Math.floor((Date.now() - this.startedAt) / 1000)
  }

  private setupSignalHandlers(): void {
    const shutdown = () => {
      this.stop().catch((err) => {
        console.error('Error during shutdown:', err)
        process.exit(1)
      })
    }

    process.on('SIGINT', shutdown)
    process.on('SIGTERM', shutdown)
    // SIGHUP: when in detached mode, ignore (survives terminal close).
    // When in foreground, treat as shutdown.
    if (process.env.DETACHED_DAEMON === '1') {
      process.on('SIGHUP', () => {
        console.log('Received SIGHUP in detached mode, ignoring')
      })
    } else {
      process.on('SIGHUP', shutdown)
    }

    process.on('uncaughtException', (err) => {
      console.error('Uncaught exception:', err)
      this.stop().catch(() => process.exit(1))
    })

    process.on('unhandledRejection', (err) => {
      console.error('Unhandled rejection:', err)
    })
  }

  private async writePidFile(): Promise<void> {
    await mkdir(this.pidDir, { recursive: true })
    await writeFile(join(this.pidDir, 'daemon.pid'), String(process.pid), 'utf-8')
  }

  private async removePidFile(): Promise<void> {
    try {
      await unlink(join(this.pidDir, 'daemon.pid'))
    } catch {
      // ignore
    }
  }
}
