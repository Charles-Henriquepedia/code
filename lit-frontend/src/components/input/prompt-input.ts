import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'
import { repeat } from 'lit/directives/repeat.js'
import type { Command } from '../../types.js'

interface FsEntry {
  name: string
  path: string
  type: 'dir' | 'file'
}

@customElement('vc-prompt-input')
export class VcPromptInput extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .input-row {
      display: flex;
      gap: 8px;
      align-items: flex-end;
    }
    .mode-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border: 1px solid var(--border, #444);
      border-radius: 4px;
      color: var(--text-secondary, #888);
      margin-bottom: 6px;
      cursor: pointer;
    }
    .mode-badge.bash { color: var(--success, #22c55e); border-color: var(--success, #22c55e); }
    .mode-badge:hover { border-color: var(--accent, #818cf8); }
    .text-input {
      flex: 1;
      background: var(--bg-tertiary, #333);
      color: var(--text-primary, #e5e5e5);
      border: 1px solid var(--border, #444);
      border-radius: 8px;
      padding: 8px 12px;
      font-size: 14px;
      font-family: inherit;
      resize: none;
      outline: none;
      min-height: 36px;
      max-height: 200px;
    }
    .text-input:focus { border-color: var(--accent, #818cf8); }
    .text-input::placeholder { color: var(--text-secondary, #888); }
    .text-input:disabled { opacity: .5; }
    .actions {
      display: flex;
      gap: 4px;
      margin-bottom: 4px;
    }
    .action-btn {
      background: var(--accent, #818cf8);
      color: #fff;
      border: none;
      border-radius: 6px;
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .action-btn:disabled { background: #444; cursor: not-allowed; }

    /* Dropdown for / commands and @ files */
    .dropdown {
      position: absolute;
      bottom: 100%;
      left: 30px;
      right: 0;
      background: var(--bg-secondary, #222);
      border: 1px solid var(--border, #444);
      border-radius: 8px;
      max-height: 240px;
      overflow-y: auto;
      box-shadow: 0 -4px 12px rgba(0,0,0,.3);
      margin-bottom: 4px;
      z-index: 10;
    }
    .dropdown-item {
      padding: 6px 12px;
      cursor: pointer;
      font-size: 12px;
    }
    .dropdown-item.selected, .dropdown-item:hover {
      background: var(--bg-tertiary, #333);
    }
    .dropdown-item .cmd { color: #e5e5e5; font-weight: 500; }
    .dropdown-item .desc { color: #888; font-size: 11px; margin-top: 2px; }
    .dropdown-item .icon { color: #818cf8; width: 16px; display: inline-block; }
    .dropdown-item.dir .icon { color: #818cf8; }
    .dropdown-item.file .icon { color: #666; }
    .dropdown-item .name { color: #e5e5e5; font-family: 'Menlo', 'Monaco', monospace; }
    .dropdown-empty { padding: 12px; color: #666; font-size: 12px; text-align: center; }
    .dropdown-footer {
      padding: 4px 12px;
      border-top: 1px solid #2a2a2a;
      font-size: 10px;
      color: #666;
      display: flex;
      justify-content: space-between;
    }
  `

  @property({ type: Array }) commands: Command[] = []
  @property() mode: 'prompt' | 'bash' = 'prompt'
  @property({ type: Boolean }) disabled = false
  @property() cwd = ''

  @state() private value = ''
  @state() private showCommands = false
  @state() private showFiles = false
  @state() private fileCwd = '/'
  @state() private fileFilter = ''
  @state() private files: FsEntry[] = []
  @state() private selectedIdx = 0
  private fileRefAt = -1
  private loadFilesReqId = 0

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    this.fileCwd = this.cwd || '/'
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('cwd') && this.cwd && this.cwd !== this.fileCwd && !this.showFiles) {
      this.fileCwd = this.cwd
    }
  }

  private async loadFiles(): Promise<void> {
    const reqId = ++this.loadFilesReqId
    try {
      const url = `/api/v1/fs/list?path=${encodeURIComponent(this.fileCwd)}&showFiles=true`
      const res = await fetch(url)
      if (!res.ok) return
      if (reqId !== this.loadFilesReqId) return // stale
      const data = await res.json() as { entries: Array<{ name: string; type: 'directory' | 'file' }> }
      const base = this.fileCwd === '/' ? '' : this.fileCwd
      this.files = (data.entries ?? []).map(e => ({
        name: e.name,
        type: e.type === 'directory' ? 'dir' : 'file',
        path: `${base}/${e.name}`,
      }))
    } catch { /* ignore */ }
  }

  /**
   * Parse the part after `@` into either a pure filter or a navigation+filter.
   * - "foo"               → filter "foo" in cwd
   * - "foo/bar"           → navigate to cwd + "foo", filter by "bar"
   * - "/abs"              → navigate to /abs, filter by "abs"
   * - "/abs/bar"          → navigate to /abs, filter by "bar"
   * - "foo/"              → navigate to cwd + "foo", filter ""
   */
  private parseAtQuery(filter: string): { mode: 'filter'; q: string } | { mode: 'navigate'; path: string; q: string } {
    const isAbs = filter.startsWith('/')
    const hasSlash = filter.includes('/')
    // Pure name filter: no slash at all
    if (!hasSlash) return { mode: 'filter', q: filter }
    // Absolute path
    if (isAbs) {
      const m = filter.match(/^(.*)\/([^/]*)$/)
      if (!m) return { mode: 'filter', q: filter }
      const [, dirPart, q] = m
      // "/" alone or "/foo/" → navigate to /foo (or /)
      const targetPath = dirPart === '' ? '/' : dirPart
      return { mode: 'navigate', path: targetPath, q }
    }
    // Relative path: "foo/bar" → navigate relative to cwd, filter by last segment
    const m = filter.match(/^(.*)\/([^/]*)$/)
    if (!m) return { mode: 'filter', q: filter }
    const [, dirPart, q] = m
    const targetPath = this.fileCwd === '/' ? `/${dirPart}` : `${this.fileCwd}/${dirPart}`
    return { mode: 'navigate', path: targetPath, q }
  }

  private get atQuery(): { startsAt: number; filter: string } | null {
    // Find the LAST `@` not preceded by a non-whitespace char (word boundary)
    let startsAt = -1
    for (let i = this.value.length - 1; i >= 0; i--) {
      const ch = this.value[i]
      if (/\s/.test(ch)) break
      if (ch === '@') { startsAt = i; break }
    }
    if (startsAt < 0) return null
    const prev = startsAt > 0 ? this.value[startsAt - 1] : ' '
    if (prev && !/\s/.test(prev)) return null
    const filter = this.value.slice(startsAt + 1)
    return { startsAt, filter }
  }

  private get filteredCommands(): Command[] {
    const query = this.value.slice(1).toLowerCase()
    return this.commands
      .filter((c) => !c.hidden && (c.name.toLowerCase().includes(query) || c.aliases.some((a) => a.includes(query))))
      .slice(0, 8)
  }

  private get filteredFiles(): FsEntry[] {
    const q = this.fileFilter.toLowerCase()
    return this.files.filter(f => !q || f.name.toLowerCase().includes(q))
  }

  private onInput(e: Event): void {
    const el = e.target as HTMLTextAreaElement
    this.value = el.value
    this.showCommands = el.value.startsWith('/')
    const atQ = this.atQuery
    const wasShowingFiles = this.showFiles
    this.showFiles = atQ !== null
    this.fileFilter = atQ?.filter ?? ''
    if (atQ) this.fileRefAt = atQ.startsAt
    this.selectedIdx = 0
    this.adjustHeight(el)

    // Show files when @ is detected; route via parseAtQuery
    if (this.showFiles) {
      const parsed = this.parseAtQuery(this.fileFilter)
      if (parsed.mode === 'navigate') {
        if (parsed.path !== this.fileCwd) {
          this.fileCwd = parsed.path
        }
      } else if (!wasShowingFiles && this.cwd && this.cwd !== this.fileCwd) {
        // First time @ is typed: reset to session cwd
        this.fileCwd = this.cwd
      }
      this.loadFiles()
      // Keep the displayed filter in sync with the parsed query (so the footer
      // shows the active filter even after navigating into a dir)
      this.fileFilter = parsed.mode === 'navigate' ? parsed.q : (this.fileFilter)
    }
  }

  private async navigateToDir(path: string): Promise<void> {
    this.fileCwd = path
    this.selectedIdx = 0
    this.loadFiles()
  }

  private goUpDir(): void {
    const parent = this.fileCwd.split('/').slice(0, -1).join('/') || '/'
    this.navigateToDir(parent)
  }

  private onKeyDown(e: KeyboardEvent): void {
    // Shift+Tab cycles permission mode (matches CLI behavior)
    if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault()
      this.dispatchEvent(new CustomEvent('cycle-permission', {
        bubbles: true,
        composed: true,
      }))
      return
    }
    if (this.showFiles) {
      const items = this.filteredFiles
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        this.selectedIdx = Math.min(this.selectedIdx + 1, items.length - 1)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        this.selectedIdx = Math.max(this.selectedIdx - 1, 0)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault()
        this.selectFile(items[this.selectedIdx])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        this.showFiles = false
        if (this.fileRefAt >= 0) this.value = this.value.slice(0, this.fileRefAt)
        return
      }
      return
    }

    if (this.showCommands && e.key === 'ArrowDown') {
      e.preventDefault()
      this.selectedIdx = Math.min(this.selectedIdx + 1, this.filteredCommands.length - 1)
      return
    }
    if (this.showCommands && e.key === 'ArrowUp') {
      e.preventDefault()
      this.selectedIdx = Math.max(this.selectedIdx - 1, 0)
      return
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault()
      this.submit()
      return
    }
    if (e.key === 'Escape' && this.showCommands) {
      this.showCommands = false
      return
    }
  }

  private submit(): void {
    if (!this.value.trim() || this.disabled) return
    const msg = this.value
    this.value = ''
    this.showCommands = false
    this.showFiles = false
    this.dispatchEvent(new CustomEvent('submit', {
      detail: { message: msg },
      bubbles: true,
      composed: true,
    }))
  }

  private selectCommand(cmd: Command): void {
    this.value = `/${cmd.name} `
    this.showCommands = false
    this.requestUpdate()
  }

  private selectFile(file: FsEntry | undefined): void {
    if (!file) return
    const atQ = this.atQuery
    if (!atQ) return
    const before = this.value.slice(0, atQ.startsAt)
    if (file.type === 'dir') {
      // Navigate into the directory: replace @query with new prefix
      const newPrefix = `@${file.path}/`
      this.value = before + newPrefix
      this.fileCwd = file.path
      this.fileFilter = ''
      this.fileRefAt = atQ.startsAt
      this.selectedIdx = 0
      this.loadFiles()
    } else {
      this.value = before + `@${file.path} `
      this.showFiles = false
    }
    this.requestUpdate()
  }

  private adjustHeight(el: HTMLTextAreaElement): void {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  render(): unknown {
    const placeholders = { prompt: 'Type a message... (/: commands, !: bash, @: files)', bash: 'Enter bash command...' }
    return html`
      ${when(this.showCommands && this.filteredCommands.length > 0, () => html`
        <div class="dropdown">
          ${repeat(
            this.filteredCommands,
            (c) => c.name,
            (c, idx) => html`
              <div class="dropdown-item ${classMap({ selected: idx === this.selectedIdx })}"
                   @click=${() => this.selectCommand(c)}
                   @mouseenter=${() => (this.selectedIdx = idx)}>
                <div class="cmd">/${c.name}</div>
                <div class="desc">${c.description}${c.aliases.length ? ` (${c.aliases.join(', ')})` : ''}</div>
              </div>
            `,
          )}
        </div>
      `)}

      ${when(this.showFiles, () => html`
        <div class="dropdown">
          <div class="dropdown-item" style="font-size:11px;color:#666;cursor:default;background:#0d0d0d">
            ${this.fileCwd}/
          </div>
          ${this.fileCwd !== '/' ? html`
            <div class="dropdown-item dir"
                 @mousedown=${(e: MouseEvent) => e.preventDefault()}
                 @click=${() => this.goUpDir()}
                 @mouseenter=${() => (this.selectedIdx = -1)}>
              <span class="icon">↑</span>
              <span class="name">..</span>
            </div>
          ` : ''}
          ${this.filteredFiles.length === 0
            ? html`<div class="dropdown-empty">No matches</div>`
            : repeat(this.filteredFiles, (f) => f.path, (f, idx) => html`
                <div class="dropdown-item ${classMap({ dir: f.type === 'dir', file: f.type === 'file', selected: idx === this.selectedIdx })}"
                     @mousedown=${(e: MouseEvent) => e.preventDefault()}
                     @click=${() => this.selectFile(f)}
                     @mouseenter=${() => (this.selectedIdx = idx)}>
                  <span class="icon">${f.type === 'dir' ? '/' : ' '}</span>
                  <span class="name">${f.name}</span>
                </div>
              `)}
          <div class="dropdown-footer">
            <span>${this.fileFilter || ''}</span>
            <span>↑↓ navigate · Enter select · Esc cancel</span>
          </div>
        </div>
      `)}

      <div class="input-row">
        <span class="mode-badge ${classMap({ bash: this.mode === 'bash' })}"
              @click=${() => this.dispatchEvent(new CustomEvent('mode-change', {
                detail: this.mode === 'prompt' ? 'bash' : 'prompt',
                bubbles: true, composed: true,
              }))}>
          ${this.mode === 'bash' ? '!' : '>'}
        </span>
        <textarea
          class="text-input"
          .value=${this.value}
          @input=${this.onInput}
          @keydown=${this.onKeyDown}
          ?disabled=${this.disabled}
          placeholder=${placeholders[this.mode]}
          rows="1"
        ></textarea>
        <div class="actions">
          <button class="action-btn" ?disabled=${this.disabled || !this.value.trim()} @click=${this.submit}>→</button>
        </div>
      </div>
    `
  }
}
