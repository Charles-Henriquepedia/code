import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'

interface SearchHit {
  type: 'file' | 'session' | 'command'
  title: string
  subtitle?: string
  path?: string
  sessionId?: string
  line?: number
  preview?: string
}

interface SearchResults {
  files: SearchHit[]
  sessions: SearchHit[]
  commands: SearchHit[]
}

@customElement('vc-command-palette')
export class VcCommandPalette extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      z-index: 1000;
      padding-top: 80px;
      background: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
    }
    .palette {
      width: 100%;
      max-width: 600px;
      background: var(--bg-secondary, #1a1a1a);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 8px;
      box-shadow: 0 20px 60px rgba(0,0,0,.5);
      overflow: hidden;
      display: flex;
      flex-direction: column;
      max-height: 70vh;
    }
    .input-row {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-bottom: 1px solid var(--border, #2a2a2a);
    }
    .input-row input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text-primary, #e5e5e5);
      font-size: 15px;
      font-family: inherit;
    }
    .input-row .icon {
      color: var(--text-secondary, #888);
      font-size: 13px;
    }
    .results {
      overflow-y: auto;
      flex: 1;
    }
    .group {
      border-bottom: 1px solid var(--border, #2a2a2a);
    }
    .group:last-child { border-bottom: none; }
    .group-header {
      padding: 6px 16px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: .5px;
      color: var(--text-secondary, #888);
      background: rgba(0,0,0,.2);
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
    }
    .item:hover, .item.selected {
      background: var(--accent, #818cf8);
      color: #fff;
    }
    .item .icon {
      width: 20px;
      text-align: center;
      color: var(--text-secondary, #888);
      flex-shrink: 0;
    }
    .item.selected .icon, .item:hover .icon {
      color: #fff;
    }
    .item .title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .item .subtitle { color: var(--text-secondary, #888); font-size: 11px; }
    .item:hover .subtitle, .item.selected .subtitle { color: rgba(255,255,255,.85); }
    .empty {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-secondary, #666);
      font-size: 12px;
    }
    .hint {
      padding: 8px 16px;
      border-top: 1px solid var(--border, #2a2a2a);
      font-size: 10px;
      color: var(--text-secondary, #666);
      display: flex;
      gap: 16px;
    }
    .hint kbd {
      background: var(--bg-tertiary, #222);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: monospace;
      margin-right: 3px;
    }
  `

  @state() private open = false
  @state() private query = ''
  @state() private results: SearchResults = { files: [], sessions: [], commands: [] }
  @state() private selectedIdx = 0
  @state() private loading = false
  private flatResults: SearchHit[] = []
  private debounceTimer = 0

  connectedCallback(): void {
    super.connectedCallback()
    window.addEventListener('keydown', this.handleKey)
  }

  disconnectedCallback(): void {
    super.disconnectedCallback()
    window.removeEventListener('keydown', this.handleKey)
  }

  private handleKey = (e: KeyboardEvent): void => {
    // Cmd+K or Ctrl+K to toggle
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault()
      this.open = !this.open
      if (this.open) {
        this.requestUpdate()
        setTimeout(() => {
          const input = this.renderRoot.querySelector('input')
          input?.focus()
        }, 50)
      }
      return
    }
    if (!this.open) return
    if (e.key === 'Escape') {
      e.preventDefault()
      this.open = false
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.selectedIdx = Math.min(this.selectedIdx + 1, this.flatResults.length - 1)
      this.requestUpdate()
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.selectedIdx = Math.max(this.selectedIdx - 1, 0)
      this.requestUpdate()
    } else if (e.key === 'Enter') {
      e.preventDefault()
      this.selectCurrent()
    }
  }

  private updateFlattened(): void {
    this.flatResults = [
      ...this.results.commands,
      ...this.results.sessions,
      ...this.results.files,
    ]
    if (this.selectedIdx >= this.flatResults.length) {
      this.selectedIdx = Math.max(0, this.flatResults.length - 1)
    }
  }

  private onInput(e: InputEvent): void {
    this.query = (e.target as HTMLInputElement).value
    this.selectedIdx = 0
    if (this.debounceTimer) clearTimeout(this.debounceTimer)
    if (this.query.length < 2) {
      this.results = { files: [], sessions: [], commands: [] }
      return
    }
    this.debounceTimer = window.setTimeout(() => this.runSearch(), 150)
  }

  private async runSearch(): Promise<void> {
    this.loading = true
    try {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(this.query)}&scope=all`)
      if (!res.ok) return
      const data = await res.json() as { hits: SearchResults }
      this.results = data.hits ?? { files: [], sessions: [], commands: [] }
      this.updateFlattened()
    } finally {
      this.loading = false
    }
  }

  private selectCurrent(): void {
    const hit = this.flatResults[this.selectedIdx]
    if (!hit) return
    this.dispatchEvent(new CustomEvent('select', { detail: hit, bubbles: true, composed: true }))
    this.open = false
  }

  private onBackdrop(e: MouseEvent): void {
    if (e.target === this) this.open = false
  }

  private renderGroup(title: string, items: SearchHit[]): unknown {
    if (items.length === 0) return ''
    return html`
      <div class="group">
        <div class="group-header">${title}</div>
        ${items.map((item) => {
          const idx = this.flatResults.indexOf(item)
          const icon = item.type === 'file' ? '📄' : item.type === 'session' ? '💬' : '⌘'
          return html`
            <div class="item ${classMap({ selected: idx === this.selectedIdx })}"
                 @click=${() => { this.selectedIdx = idx; this.selectCurrent() }}
                 @mouseenter=${() => { this.selectedIdx = idx; this.requestUpdate() }}>
              <span class="icon">${icon}</span>
              <span class="title">${item.title}</span>
              ${item.subtitle ? html`<span class="subtitle">${item.subtitle}</span>` : ''}
            </div>
          `
        })}
      </div>
    `
  }

  render(): unknown {
    if (!this.open) return html``
    this.updateFlattened()
    return html`
      <div @click=${this.onBackdrop}>
        <div class="palette" @click=${(e: Event) => e.stopPropagation()}>
          <div class="input-row">
            <span class="icon">⌕</span>
            <input
              type="text"
              placeholder="Search Verboo — files, sessions, commands..."
              .value=${this.query}
              @input=${this.onInput}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                  e.preventDefault()
                  this.handleKey(e)
                }
              }}
            />
            <span style="font-size:11px;color:var(--text-secondary,#888)">${this.loading ? '...' : ''}</span>
          </div>
          <div class="results">
            ${this.query.length < 2
              ? html`<div class="empty">Type at least 2 characters to search</div>`
              : this.flatResults.length === 0
                ? html`<div class="empty">No results</div>`
                : html`
                    ${this.renderGroup('Commands', this.results.commands)}
                    ${this.renderGroup('Sessions', this.results.sessions)}
                    ${this.renderGroup('Files', this.results.files)}
                  `}
          </div>
          <div class="hint">
            <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
            <span><kbd>↵</kbd> select</span>
            <span><kbd>esc</kbd> close</span>
          </div>
        </div>
      </div>
    `
  }
}

function classMap<T extends Record<string, boolean | string | number>>(classes: T): string {
  return Object.entries(classes).filter(([, v]) => !!v).map(([k]) => k).join(' ')
}
