import type { Message, StreamEvent } from '../types.js'

class MessageStore {
  private messages: Message[] = []
  private streamingText = ''
  private streamingThinking = ''
  private listeners = new Set<(state: MessageStoreState) => void>()

  getMessages(): Message[] {
    return [...this.messages]
  }

  getStreamingText(): string {
    return this.streamingText
  }

  getStreamingThinking(): string {
    return this.streamingThinking
  }

  addUserMessage(text: string): void {
    this.messages = [...this.messages, {
      id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: 'user',
      content: [{ type: 'text', text }],
    } as Message]
    this.notify()
  }

  handleStreamEvent(event: StreamEvent): void {
    const e = event as Record<string, unknown>
    switch (e.type) {
      case 'text':
        this.streamingText += (e as { text: string }).text
        break
      case 'thinking':
        this.streamingThinking += (e as { thinking: string }).thinking
        break
      case 'tool_use': {
        const tu = e as unknown as { id: string; name: string; input: unknown }
        this.messages = [...this.messages, {
          id: tu.id,
          role: 'assistant',
          content: [{ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input }],
        } as Message]
        break
      }
      case 'tool_result': {
        const tr = e as unknown as { tool_use_id: string; content: unknown; is_error?: boolean }
        this.messages = [...this.messages, {
          id: `result-${tr.tool_use_id}`,
          role: 'user',
          content: [{
            type: 'tool_result',
            tool_use_id: tr.tool_use_id,
            content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content),
            is_error: tr.is_error,
          }],
        } as Message]
        break
      }
      case 'message_stop':
        this.finalizeStreamingMessage()
        break
    }
    this.notify()
  }

  finalizeStreamingMessage(): void {
    if (this.streamingText) {
      this.messages = [...this.messages, {
        id: `msg-${Date.now()}`,
        role: 'assistant',
        content: [{ type: 'text', text: this.streamingText }],
      } as Message]
    }
    this.streamingText = ''
    this.streamingThinking = ''
    this.notify()
  }

  clearStreaming(): void {
    this.streamingText = ''
    this.streamingThinking = ''
    this.notify()
  }

  reset(): void {
    this.messages = []
    this.streamingText = ''
    this.streamingThinking = ''
    this.notify()
  }

  subscribe(listener: (state: MessageStoreState) => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    const state: MessageStoreState = {
      messages: this.getMessages(),
      streamingText: this.streamingText,
      streamingThinking: this.streamingThinking,
    }
    for (const listener of this.listeners) {
      listener(state)
    }
  }
}

export interface MessageStoreState {
  messages: Message[]
  streamingText: string
  streamingThinking: string
}

export const messageStore = new MessageStore()
