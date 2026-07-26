import type { Message } from '../types.js'

export type PermissionMode = 'default' | 'plan' | 'acceptEdits' | 'bypassPermissions'

export interface ContextUsage {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
  costUSD: number
}

export interface TabState {
  id: string
  title: string
  type: 'sdk' | 'pty' | 'attach'
  cwd: string
  model: string
  state: string
  messages: Message[]
  streamingText: string
  streamingThinking: string
  isProcessing: boolean
  processingStartedAt: number | null
  pid?: number | null
  contextUsage?: ContextUsage
  permissionMode: PermissionMode
}

class TabStore {
  private tabs = new Map<string, TabState>()
  private activeId: string | null = null
  private listeners = new Set<() => void>()

  getTabs(): TabState[] {
    return Array.from(this.tabs.values())
  }

  getActive(): TabState | null {
    return this.activeId ? (this.tabs.get(this.activeId) ?? null) : null
  }

  getActiveId(): string | null {
    return this.activeId
  }

  add(tab: TabState): void {
    this.tabs.set(tab.id, tab)
    if (!this.activeId) this.activeId = tab.id
    this.notify()
  }

  remove(id: string): void {
    this.tabs.delete(id)
    if (this.activeId === id) {
      const remaining = Array.from(this.tabs.keys())
      this.activeId = remaining.length > 0 ? remaining[remaining.length - 1]! : null
    }
    this.notify()
  }

  setActive(id: string): void {
    if (this.tabs.has(id)) {
      this.activeId = id
      this.notify()
    }
  }

  updateTitle(id: string, title: string): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.title = title
      this.notify()
    }
  }

  get(id: string): TabState | undefined {
    return this.tabs.get(id)
  }

  updateState(id: string, state: string): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.state = state
      const wasIdle = !tab.isProcessing
      tab.isProcessing = state === 'running'
      if (tab.isProcessing && wasIdle) {
        tab.processingStartedAt = Date.now()
      } else if (!tab.isProcessing) {
        tab.processingStartedAt = null
      }
      this.notify()
    }
  }

  updateModel(id: string, model: string): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.model = model
      this.notify()
    }
  }

  updateContextUsage(id: string, usage: ContextUsage): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.contextUsage = usage
      this.notify()
    }
  }

  setPermissionMode(id: string, mode: PermissionMode): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.permissionMode = mode
      this.notify()
    }
  }

  updateToolStatus(id: string, toolUseId: string, status: 'running' | 'done' | 'error', durationMs?: number): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    // Find the tool_use message and update its status
    tab.messages = tab.messages.map((m) => {
      if (m.id === toolUseId && m.role === 'assistant') {
        const updates: Record<string, unknown> = { status }
        if (durationMs !== undefined) updates.toolDuration = durationMs
        return { ...m, ...updates } as Message
      }
      return m
    }) as Message[]
    this.notify()
  }

  appendMessage(id: string, msg: Message): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.messages = [...tab.messages, msg]
      this.notify()
    }
  }

  appendStreamingText(id: string, text: string): void {
    const tab = this.tabs.get(id)
    if (tab) tab.streamingText += text
  }

  appendStreamingThinking(id: string, text: string): void {
    const tab = this.tabs.get(id)
    if (tab) tab.streamingThinking += text
  }

  finalizeStreaming(id: string): void {
    const tab = this.tabs.get(id)
    if (!tab) return
    if (tab.streamingText) {
      tab.messages = [...tab.messages, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: [{ type: 'text', text: tab.streamingText }],
      } as Message]
    }
    // Append "Crunched for X" system event if there was a tracked duration
    if (tab.processingStartedAt) {
      const elapsedMs = Date.now() - tab.processingStartedAt
      const elapsedStr = formatElapsed(elapsedMs)
      tab.messages = [...tab.messages, {
        id: `sys-${Date.now()}`,
        role: 'system',
        subtype: 'crunched',
        text: `Crunched for ${elapsedStr}`,
      } as Message]
    }
    tab.streamingText = ''
    tab.streamingThinking = ''
    tab.isProcessing = false
    tab.processingStartedAt = null
    this.notify()
  }

  clearStreaming(id: string): void {
    const tab = this.tabs.get(id)
    if (tab) {
      tab.streamingText = ''
      tab.streamingThinking = ''
    }
  }

  isActive(id: string): boolean {
    return this.activeId === id
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}

export const tabStore = new TabStore()

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return `${m}m ${rem}s`
}
