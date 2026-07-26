class ConnectionStore {
  private connected = false
  private listeners = new Set<(c: boolean) => void>()

  setConnected(connected: boolean): void {
    this.connected = connected
    this.notify()
  }

  isConnected(): boolean {
    return this.connected
  }

  subscribe(listener: (c: boolean) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const listener of this.listeners) {
      listener(this.connected)
    }
  }
}

export const connectionStore = new ConnectionStore()
