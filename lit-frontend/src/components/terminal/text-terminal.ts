import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { tabStore } from '../../state/tab-store.js'

type Role = 'user' | 'assistant' | 'system' | 'tool' | 'thinking'

interface Line {
  id: string
  role: Role
  text: string
  ts?: number
}

const ROLE_PREFIX: Record<Role, string> = {
  user: '›',
  assistant: '●',
  system: '※',
  tool: '⏺',
  thinking: '…',
}

const ROLE_COLOR: Record<Role, string> = {
  user: '#22c55e',
  assistant: '#818cf8',
  system: '#888',
  tool: '#f59e0b',
  thinking: '#666',
}

@customElement('vc-text-terminal')
export class VcTextTerminal extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: #0d0d0d;
      color: #e5e5e5;
      font-family: 'Menlo', 'Monaco', 'Courier New', monospace;
      font-size: 12px;
      line-height: 1.5;
    }
    .output {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .output::-webkit-scrollbar { width: 8px; }
    .output::-webkit-scrollbar-track { background: transparent; }
    .output::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 4px; }
    .line { display: block; padding: 1px 0; }
    .line .prefix { color: var(--role-color, #888); margin-right: 6px; font-weight: 600; }
    .line.user .text { color: #e5e5e5; }
    .line.tool .text { color: #fbbf24; }
    .line.thinking .text { color: #666; font-style: italic; }
    .input-row {
      display: flex;
      align-items: flex-end;
      gap: 6px;
      padding: 6px 10px;
      border-top: 1px solid #2a2a2a;
      background: #1a1a1a;
    }
    .input-row .prompt {
      color: #818cf8;
      font-weight: 700;
      padding-bottom: 4px;
      flex-shrink: 0;
    }
    .input-row textarea {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: #e5e5e5;
      font-family: inherit;
      font-size: 12px;
      resize: none;
      min-height: 20px;
      max-height: 120px;
      line-height: 1.5;
    }
    .input-row button {
      background: #818cf8;
      color: #fff;
      border: none;
      border-radius: 3px;
      padding: 4px 10px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .input-row button:disabled { opacity: .4; cursor: not-allowed; }
    .input-row button:hover:not(:disabled) { background: #6366f1; }
    .empty { color: #555; font-style: italic; padding: 20px; text-align: center; }
  `

  @property({ type: String }) sessionId = ''
  @state() private lines: Line[] = []
  @state() private input = ''
  @state() private submitting = false

  private inputEl?: HTMLTextAreaElement

  connectedCallback(): void {
    super.connectedCallback()
    const tab = tabStore.getTabs().find(t => t.id === this.sessionId)
    if (tab) this.seedFromTab(tab)
  }

  private seedFromTab(tab: { messages: Array<{ id: string; role: string; content: Array<{ type: string; text?: string; thinking?: string; name?: string; input?: unknown }> }>; streamingText: string; streamingThinking: string }): void {
    const seeded: Line[] = []
    for (const m of tab.messages) {
      const role = m.role as Role
      if (role === 'user' || role === 'assistant' || role === 'system') {
        for (const c of m.content ?? []) {
          if (c.type === 'text' && c.text) {
            seeded.push({ id: m.id, role, text: c.text })
          } else if (c.type === 'thinking' && c.thinking) {
            seeded.push({ id: `${m.id}-t`, role: 'thinking', text: c.thinking })
          } else if (c.type === 'tool_use') {
            seeded.push({ id: `${m.id}-tool`, role: 'tool', text: `[tool] ${c.name ?? '?'}` })
          }
        }
      }
    }
    if (tab.streamingText) {
      seeded.push({ id: 'stream', role: 'assistant', text: tab.streamingText })
    }
    if (tab.streamingThinking) {
      seeded.push({ id: 'stream-think', role: 'thinking', text: tab.streamingThinking })
    }
    this.lines = seeded
    this.scheduleScroll()
  }

  private scheduleScroll(): void {
    requestAnimationFrame(() => {
      const out = this.renderRoot?.querySelector('.output') as HTMLElement | null
      if (out) out.scrollTop = out.scrollHeight
    })
  }

  private adjustHeight(e: Event): void {
    const el = e.target as HTMLTextAreaElement
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  private onKey(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.submit()
    }
  }

  private async submit(): Promise<void> {
    const text = this.input.trim()
    if (!text || this.submitting) return
    this.input = ''
    if (this.inputEl) this.inputEl.style.height = '20px'
    this.submitting = true
    this.lines = [...this.lines, { id: `user-${Date.now()}`, role: 'user', text }]
    this.scheduleScroll()
    try {
      const wsBase = location.protocol === 'https:' ? 'wss' : 'ws'
      const ws = new WebSocket(`${wsBase}://${location.host}/api/v1/ws?session_id=${this.sessionId}`)
      ws.onopen = () => {
        ws.send(JSON.stringify({ type: 'input', message: text }))
      }
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data)
          if (data.type === 'stream_event' && data.event) {
            const evt = data.event
            if (evt.type === 'assistant' && evt.message?.content) {
              for (const c of evt.message.content) {
                if (c.type === 'text' && c.text) {
                  this.lines = [...this.lines, { id: `asst-${Date.now()}-${Math.random()}`, role: 'assistant', text: c.text }]
                } else if (c.type === 'thinking' && c.thinking) {
                  this.lines = [...this.lines, { id: `think-${Date.now()}-${Math.random()}`, role: 'thinking', text: c.thinking }]
                } else if (c.type === 'tool_use') {
                  const input = c.input ? JSON.stringify(c.input).slice(0, 200) : ''
                  this.lines = [...this.lines, { id: `tool-${Date.now()}-${Math.random()}`, role: 'tool', text: `[${c.name ?? '?'}] ${input}` }]
                }
              }
              this.scheduleScroll()
            } else if (evt.type === 'result') {
              ws.close()
            }
          } else if (data.type === 'interrupted') {
            ws.close()
          }
        } catch { /* ignore */ }
      }
      ws.onerror = () => ws.close()
      ws.onclose = () => { this.submitting = false }
    } catch (err) {
      this.lines = [...this.lines, { id: `err-${Date.now()}`, role: 'system', text: `Error: ${(err as Error).message}` }]
      this.submitting = false
    }
  }

  render(): unknown {
    return html`
      <div class="output">
        ${this.lines.length === 0
          ? html`<div class="empty">No output yet. Type a message below to start the Verboo session.</div>`
          : repeat(this.lines, l => l.id, l => html`
              <div class="line ${l.role}" style="--role-color: ${ROLE_COLOR[l.role]}">
                <span class="prefix">${ROLE_PREFIX[l.role]}</span><span class="text">${l.text}</span>
              </div>
            `)}
      </div>
      <div class="input-row">
        <span class="prompt">›</span>
        <textarea
          rows="1"
          placeholder="Message Verboo..."
          .value=${this.input}
          @input=${(e: InputEvent) => { this.input = (e.target as HTMLTextAreaElement).value; this.adjustHeight(e) }}
          @keydown=${this.onKey}
        ></textarea>
        <button @click=${this.submit} ?disabled=${this.submitting || !this.input.trim()}>${this.submitting ? '…' : 'Send'}</button>
      </div>
    `
  }
}
