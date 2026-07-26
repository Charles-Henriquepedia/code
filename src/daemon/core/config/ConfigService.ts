import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { homedir, hostname } from 'node:os'

export interface DaemonConfig {
  port: number
  host: string
  runtime: string
  autoStart: boolean
  maxSessions: number
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  sessionTimeout: number
  allowedOrigins: string[]
}

const DEFAULT_CONFIG: DaemonConfig = {
  port: 8765,
  host: '127.0.0.1',
  runtime: 'verboo',
  autoStart: false,
  maxSessions: 8,
  logLevel: 'info',
  sessionTimeout: 30 * 60 * 1000,
  allowedOrigins: ['http://localhost:8765'],
}

export class ConfigService {
  private config: DaemonConfig = { ...DEFAULT_CONFIG }
  private configPath: string
  private loaded = false

  constructor(baseDir?: string) {
    const dir = baseDir ?? join(homedir(), '.verboo', 'daemon')
    this.configPath = join(dir, 'config.json')
  }

  async load(): Promise<DaemonConfig> {
    if (this.loaded) return this.config
    try {
      const data = await readFile(this.configPath, 'utf-8')
      const parsed = JSON.parse(data) as Partial<DaemonConfig>
      this.config = { ...DEFAULT_CONFIG, ...parsed }
    } catch {
      this.config = { ...DEFAULT_CONFIG }
    }
    this.loaded = true
    return this.config
  }

  async save(config: Partial<DaemonConfig>): Promise<DaemonConfig> {
    await this.load()
    this.config = { ...this.config, ...config }
    const dir = this.configPath.split('/').slice(0, -1).join('/')
    await mkdir(dir, { recursive: true })
    await writeFile(this.configPath, JSON.stringify(this.config, null, 2), 'utf-8')
    return this.config
  }

  get(): DaemonConfig {
    return { ...this.config }
  }

  getHostPort(): { host: string; port: number } {
    return { host: this.config.host, port: this.config.port }
  }

  isLoaded(): boolean {
    return this.loaded
  }
}
