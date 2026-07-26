import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'

interface FsEntry {
  name: string
  type: 'dir' | 'file' | 'directory'
  path: string
}

@customElement('vc-file-picker')
export class VcFilePicker extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.5);
    }
    .picker {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      width: 480px;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0,0,0,.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #2a2a2a;
      font-weight: 600;
      font-size: 13px;
    }
    .close-btn {
      background: none; border: none;
      color: #666; cursor: pointer; font-size: 18px; line-height: 1;
    }
    .close-btn:hover { color: #e5e5e5; }
    .body { display: flex; flex-direction: column; min-height: 0; }

    .path-bar {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 16px;
      background: #0d0d0d;
      border-bottom: 1px solid #2a2a2a;
      flex-wrap: wrap;
    }
    .path-segment {
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      color: #818cf8;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .path-segment:hover { background: #222; }
    .path-sep { color: #555; font-size: 12px; }
    .path-input {
      flex: 1;
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      color: #e5e5e5;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 12px;
      padding: 4px 8px;
      border-radius: 4px;
      margin-left: 8px;
      min-width: 100px;
    }
    .path-input:focus { border-color: #6366f1; outline: none; }

    .filter {
      padding: 6px 16px;
      background: #0d0d0d;
      border-bottom: 1px solid #2a2a2a;
    }
    .filter-input {
      width: 100%;
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      color: #e5e5e5;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .filter-input:focus { border-color: #6366f1; outline: none; }

    .list {
      overflow-y: auto;
      max-height: 360px;
      padding: 4px 0;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      cursor: pointer;
      font-size: 12px;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .item:hover, .item.selected { background: #222; }
    .item .icon { color: #818cf8; width: 16px; }
    .item .name { color: #e5e5e5; }
    .item .meta { color: #666; margin-left: auto; font-size: 11px; }
    .item.up { color: #888; border-bottom: 1px solid #2a2a2a; }
    .empty { padding: 32px 16px; text-align: center; color: #666; font-size: 12px; }

    .footer {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 10px 16px;
      border-top: 1px solid #2a2a2a;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
    }
    .btn-primary { background: #6366f1; color: #fff; }
    .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: #888;
      border: 1px solid #2a2a2a;
    }
    .btn-secondary:hover { color: #e5e5e5; }
  `

  /** Initial path. Empty string = home directory */
  @property() initialPath = ''
  /** Show "files" option in addition to directories */
  @property({ type: Boolean }) showFiles = false
  /** Title shown in the header */
  @property() title = 'Select directory'

  @state() private cwd = '/'
  @state() private entries: FsEntry[] = []
  @state() private filter = ''
  @state() private selectedIdx = 0
  @state() private loading = false
  @state() private pathInputValue = ''

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    if (this.initialPath) {
      this.cwd = this.initialPath
    } else {
      try {
        const res = await fetch('/api/v1/fs/home')
        const data = await res.json() as { path: string }
        this.cwd = data.path
      } catch {
        this.cwd = '/'
      }
    }
    this.pathInputValue = this.cwd
    await this.loadEntries()
    this.focusFilter()
  }

  private focusFilter(): void {
    requestAnimationFrame(() => {
      const input = this.renderRoot.querySelector('.filter-input') as HTMLInputElement
      if (input) input.focus()
    })
  }

  private async loadEntries(): Promise<void> {
    this.loading = true
    try {
      const url = `/api/v1/fs/list?path=${encodeURIComponent(this.cwd)}&showFiles=${this.showFiles}`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { path: string; entries: Array<{ name: string; type: 'directory' | 'file' }> }
      // Construct full path for each entry (server doesn't include it)
      const base = this.cwd === '/' ? '' : this.cwd
      this.entries = (data.entries ?? []).map(e => ({
        name: e.name,
        type: e.type === 'directory' ? 'dir' : 'file',
        path: `${base}/${e.name}`,
      }))
      this.selectedIdx = 0
    } catch (err) {
      this.entries = []
    } finally {
      this.loading = false
    }
  }

  private get filteredEntries(): FsEntry[] {
    if (!this.filter) return this.entries
    const q = this.filter.toLowerCase()
    return this.entries.filter(e => e.name.toLowerCase().includes(q))
  }

  private goUp(): void {
    const parent = this.cwd.split('/').slice(0, -1).join('/') || '/'
    this.cwd = parent
    this.pathInputValue = this.cwd
    this.loadEntries()
  }

  private goTo(path: string): void {
    this.cwd = path
    this.pathInputValue = this.cwd
    this.loadEntries()
  }

  private goToSegment(idx: number): void {
    const segments = this.cwd.split('/').filter(Boolean)
    if (idx === -1) {
      this.goTo('/')
      return
    }
    const path = '/' + segments.slice(0, idx + 1).join('/')
    this.goTo(path)
  }

  private onKeyDown(e: KeyboardEvent): void {
    const items = this.filteredEntries
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.selectedIdx = Math.min(this.selectedIdx + 1, items.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      // Allow going up to ".." item
      this.selectedIdx = Math.max(this.selectedIdx - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[this.selectedIdx]
      if (item?.type === 'dir') {
        this.goTo(item.path)
        this.filter = ''
      }
    } else if (e.key === 'Backspace' && !this.filter) {
      e.preventDefault()
      this.goUp()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
    }
  }

  private confirm(): void {
    this.dispatchEvent(new CustomEvent('select', {
      detail: { path: this.cwd },
      bubbles: true,
      composed: true,
    }))
  }

  private get pathSegments(): Array<{ label: string; idx: number }> {
    const parts = this.cwd.split('/').filter(Boolean)
    return parts.map((p, i) => ({ label: p, idx: i }))
  }

  render(): unknown {
    return html`
      <div class="picker" @click=${(e: Event) => e.stopPropagation()}>
        <div class="header">
          <span>${this.title}</span>
          <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>×</button>
        </div>

        <div class="body">
          <div class="path-bar">
            <span class="path-segment" @click=${() => this.goToSegment(-1)}>root</span>
            ${this.pathSegments.map(s => html`
              <span class="path-sep">/</span>
              <span class="path-segment" @click=${() => this.goToSegment(s.idx)}>${s.label}</span>
            `)}
            <input
              class="path-input"
              .value=${this.pathInputValue}
              @change=${(e: Event) => {
                const newPath = (e.target as HTMLInputElement).value
                this.goTo(newPath)
                this.filter = ''
              }}
              spellcheck="false"
            />
          </div>

          <div class="filter">
            <input
              class="filter-input"
              placeholder="Filter…"
              .value=${this.filter}
              @input=${(e: Event) => {
                this.filter = (e.target as HTMLInputElement).value
                this.selectedIdx = 0
              }}
              @keydown=${this.onKeyDown}
            />
          </div>

          <div class="list" @click=${(e: Event) => e.stopPropagation()}>
            ${when(this.cwd !== '/', () => html`
              <div class="item up" @click=${() => this.goUp()}>
                <span class="icon">↩</span>
                <span class="name">..</span>
                <span class="meta">parent</span>
              </div>
            `)}
            ${this.filteredEntries.length === 0
              ? html`<div class="empty">${this.loading ? 'Loading…' : 'Empty directory'}</div>`
              : this.filteredEntries.map((e, idx) => html`
                  <div class="item ${classMap({ selected: idx === this.selectedIdx })}"
                       @click=${() => {
                         if (e.type === 'dir') {
                           this.goTo(e.path)
                           this.filter = ''
                         } else {
                           this.cwd = e.path
                           this.confirm()
                         }
                       }}
                       @mouseenter=${() => (this.selectedIdx = idx)}>
                    <span class="icon">${e.type === 'dir' ? '/' : ' '}</span>
                    <span class="name">${e.name}</span>
                  </div>
                `)}
          </div>
        </div>

        <div class="footer">
          <button class="btn btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>Cancel</button>
          <button class="btn btn-primary" @click=${this.confirm}>Select</button>
        </div>
      </div>
    `
  }
}
