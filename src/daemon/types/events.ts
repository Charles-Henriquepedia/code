export type SystemEvent =
  | { type: 'session.created'; sessionId: string; timestamp: number }
  | { type: 'session.destroyed'; sessionId: string; reason: string; timestamp: number }
  | { type: 'session.started'; sessionId: string; model: string; timestamp: number }
  | { type: 'session.stopped'; sessionId: string; reason: string; timestamp: number }
  | { type: 'session.error'; sessionId: string; error: string; timestamp: number }
  | { type: 'session.state_changed'; sessionId: string; state: string; timestamp: number }
  | { type: 'session.output'; sessionId: string; event: unknown; timestamp: number }
  | { type: 'session.transcript_append'; sessionId: string; entry: unknown; timestamp: number }
  | { type: 'session.lock_acquired'; sessionId: string; owner: 'cli' | 'web'; timestamp: number }
  | { type: 'session.lock_released'; sessionId: string; owner: 'cli' | 'web'; timestamp: number }
  | { type: 'model.changed'; sessionId: string; model: string; timestamp: number }
  | { type: 'command.executed'; sessionId: string; command: string; args: string[]; timestamp: number }
  | { type: 'skill.executed'; sessionId: string; skill: string; timestamp: number }
  | { type: 'tool.called'; sessionId: string; tool: string; input: unknown; timestamp: number }
  | { type: 'daemon.starting'; pid: number; timestamp: number }
  | { type: 'daemon.started'; pid: number; port: number; timestamp: number }
  | { type: 'daemon.stopping'; reason: string; timestamp: number }
  | { type: 'daemon.stopped'; exitCode: number; timestamp: number }

export type EventHandler<T extends SystemEvent = SystemEvent> = (event: T) => void

export interface IEventBus {
  emit(event: SystemEvent): void
  on<T extends SystemEvent['type']>(
    type: T,
    handler: EventHandler<Extract<SystemEvent, { type: T }>>,
  ): () => void
  once<T extends SystemEvent['type']>(
    type: T,
    handler: EventHandler<Extract<SystemEvent, { type: T }>>,
  ): void
  off(type: string, handler: EventHandler): void
  removeAllListeners(): void
}
