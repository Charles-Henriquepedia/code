import type { SystemEvent, EventHandler, IEventBus } from '../../types/events.js'

type HandlerEntry = {
  handler: EventHandler
  once: boolean
}

export class EventBus implements IEventBus {
  private handlers = new Map<string, Set<HandlerEntry>>()

  emit(event: SystemEvent): void {
    const entries = this.handlers.get(event.type)
    if (!entries) return

    const toRemove: HandlerEntry[] = []
    for (const entry of entries) {
      entry.handler(event)
      if (entry.once) toRemove.push(entry)
    }
    for (const entry of toRemove) {
      entries.delete(entry)
    }
  }

  on<T extends SystemEvent['type']>(
    type: T,
    handler: EventHandler<Extract<SystemEvent, { type: T }>>,
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add({ handler: handler as EventHandler, once: false })
    return () => this.off(type, handler as EventHandler)
  }

  once<T extends SystemEvent['type']>(
    type: T,
    handler: EventHandler<Extract<SystemEvent, { type: T }>>,
  ): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set())
    }
    this.handlers.get(type)!.add({ handler: handler as EventHandler, once: true })
  }

  off(type: string, handler: EventHandler): void {
    const entries = this.handlers.get(type)
    if (!entries) return
    for (const entry of entries) {
      if (entry.handler === handler) {
        entries.delete(entry)
        break
      }
    }
    if (entries.size === 0) this.handlers.delete(type)
  }

  removeAllListeners(): void {
    this.handlers.clear()
  }
}
