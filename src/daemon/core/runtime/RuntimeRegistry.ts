import type { IRuntime, RuntimeConfig } from '../../types/runtime.js'
import { EventBus } from '../event/EventBus.js'
import { EventTypes } from '../event/EventTypes.js'

export class RuntimeRegistry {
  private runtimes = new Map<string, IRuntime>()
  private initialized = false
  public readonly events = new EventBus()

  register(runtime: IRuntime): void {
    if (this.runtimes.has(runtime.id)) {
      throw new Error(`Runtime already registered: ${runtime.id}`)
    }
    this.runtimes.set(runtime.id, runtime)
  }

  get(id: string): IRuntime | undefined {
    return this.runtimes.get(id)
  }

  list(): IRuntime[] {
    return Array.from(this.runtimes.values())
  }

  async initializeAll(configs: RuntimeConfig[]): Promise<void> {
    if (this.initialized) return
    for (const config of configs) {
      const runtime = this.runtimes.get(config.id)
      if (runtime) {
        await runtime.initialize(config)
      }
    }
    this.initialized = true
  }

  async shutdownAll(): Promise<void> {
    for (const runtime of this.runtimes.values()) {
      await runtime.shutdown().catch(() => {})
    }
    this.runtimes.clear()
    this.initialized = false
    this.events.emit({
      type: EventTypes.DAEMON_STOPPED as 'daemon.stopped',
      exitCode: 0,
      timestamp: Date.now(),
    })
    this.events.removeAllListeners()
  }

  isInitialized(): boolean {
    return this.initialized
  }
}
