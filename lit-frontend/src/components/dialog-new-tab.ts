import { LitElement, html, css } from 'lit'
import { customElement, state, property } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'
import type { DaemonClient } from '../api/client.js'
import './file-picker.js'

@customElement('vc-dialog-new-tab')
export class VcDialogNewTab extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 100;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.5);
    }
    .dialog {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      width: 520px;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0,0,0,.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      border-bottom: 1px solid #2a2a2a;
      font-weight: 600;
      font-size: 14px;
    }
    .close-btn {
      background: none; border: none;
      color: #666; cursor: pointer; font-size: 18px; line-height: 1;
    }
    .close-btn:hover { color: #e5e5e5; }
    .body { padding: 16px 18px; overflow-y: auto; flex: 1; }

    .mode-tabs {
      display: flex; gap: 0; margin-bottom: 16px;
      border-bottom: 1px solid #2a2a2a;
    }
    .mode-tab {
      flex: 1;
      padding: 10px 8px;
      text-align: center;
      cursor: pointer;
      font-size: 12px;
      color: #888;
      border-bottom: 2px solid transparent;
      transition: color .15s, border-color .15s;
    }
    .mode-tab:hover { color: #e5e5e5; }
    .mode-tab.active {
      color: #818cf8;
      border-bottom-color: #818cf8;
    }

    .section-label {
      font-size: 11px;
      color: #888;
      text-transform: uppercase;
      letter-spacing: .05em;
      margin-bottom: 8px;
    }

    .field { margin-bottom: 12px; }
    .field-input {
      width: 100%;
      padding: 8px 10px;
      background: #0d0d0d;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
      color: #e5e5e5;
      font-size: 13px;
      box-sizing: border-box;
      font-family: inherit;
    }
    .field-input:focus { border-color: #6366f1; outline: none; }
    .field-input.mono { font-family: 'Menlo', 'Monaco', monospace; font-size: 12px; }

    .session-list {
      max-height: 320px;
      overflow-y: auto;
      border: 1px solid #2a2a2a;
      border-radius: 6px;
    }
    .session-item {
      padding: 10px 12px;
      cursor: pointer;
      border-bottom: 1px solid #1f1f1f;
      transition: background .1s;
    }
    .session-item:last-child { border-bottom: none; }
    .session-item:hover { background: #222; }
    .session-item.selected { background: #1e1b4b; }
    .session-item .title {
      font-size: 13px;
      font-weight: 600;
      color: #e5e5e5;
      margin-bottom: 2px;
    }
    .session-item .meta {
      display: flex;
      gap: 8px;
      font-size: 11px;
      color: #888;
      align-items: center;
    }
    .session-item .cwd {
      font-size: 11px;
      color: #666;
      font-family: 'Menlo', 'Monaco', monospace;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty {
      padding: 24px 16px;
      text-align: center;
      color: #666;
      font-size: 12px;
    }

    .actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      padding: 12px 18px;
      border-top: 1px solid #2a2a2a;
    }
    .btn {
      padding: 8px 18px;
      border-radius: 6px;
      border: none;
      cursor: pointer;
      font-size: 13px;
      font-weight: 500;
    }
    .btn-primary {
      background: #6366f1;
      color: #fff;
    }
    .btn-primary:disabled { opacity: .4; cursor: not-allowed; }
    .btn-secondary {
      background: transparent;
      color: #888;
      border: 1px solid #2a2a2a;
    }
    .btn-secondary:hover { color: #e5e5e5; border-color: #444; }
  `

  @property({ type: Object }) client!: DaemonClient
  @property({ type: Array }) models: Array<{ id: string; name: string }> = []
  @state() private mode: 'spawn' | 'cli' = 'cli'
  @state() private cwd = ''
  @state() private homeDir = '/'
  @state() private model = 'ultra/glm-5.2'
  @state() private tabTitle = ''
  @state() private cliSessions: Array<{ id: string; project: string; cwd: string | null; size: number; modifiedAt: number; slug: string | null }> = []
  @state() private selectedCliSession: string | null = null
  @state() private selectedCliCwd: string | null = null
  @state() private selectedCliSlug: string | null = null
  @state() private loading = false
  @state() private showFilePicker = false

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    await this.loadHome()
    await this.loadCliSessions()
  }

  private async loadHome(): Promise<void> {
    try {
      const res = await fetch('/api/v1/fs/home')
      const data = await res.json() as { path: string }
      this.homeDir = data.path
      this.cwd = data.path
    } catch {
      this.cwd = '/home'
      this.homeDir = '/home'
    }
  }

  private async loadCliSessions(): Promise<void> {
    this.loading = true
    try {
      const res = await fetch('/api/v1/cli-sessions')
      const data = await res.json() as { sessions: Array<{ id: string; project: string; cwd: string | null; size: number; modifiedAt: number; slug: string | null }> }
      this.cliSessions = (data.sessions ?? []).slice(0, 30)
    } catch {
      this.cliSessions = []
    } finally {
      this.loading = false
    }
  }

  private formatRelativeTime(ts: number): string {
    const diff = Date.now() - ts
    const minutes = Math.floor(diff / 60_000)
    if (minutes < 1) return 'just now'
    if (minutes < 60) return `${minutes}m ago`
    const hours = Math.floor(minutes / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    if (days < 7) return `${days}d ago`
    return new Date(ts).toLocaleDateString()
  }

  private humanizeProject(project: string): string {
    const parts = project.split('-').filter(Boolean)
    if (parts.length === 0) return project
    return parts[parts.length - 1] || project
  }

  private async createTab(): Promise<void> {
    this.loading = true
    try {
      if (this.mode === 'cli') {
        if (!this.selectedCliSession) throw new Error('Select a session to resume')
        const res = await fetch(`/api/v1/sessions/${this.selectedCliSession}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd: this.selectedCliCwd }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json() as { session: { id: string; cwd: string; model?: string; slug?: string; transcriptEntries?: unknown[] } }
        this.dispatchEvent(new CustomEvent('tab-created', {
          detail: {
            tab: {
              id: data.session.id,
              type: 'sdk',
              title: data.session.slug || this.selectedCliSlug || `session-${data.session.id.slice(0, 8)}`,
              cwd: data.session.cwd,
              model: data.session.model ?? 'ultra/glm-5.2',
            },
            transcriptEntries: data.session.transcriptEntries ?? [],
          },
          bubbles: true,
          composed: true,
        }))
        this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
        return
      }

      const res = await fetch('/api/v1/tabs/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: this.cwd, model: this.model, title: this.tabTitle || undefined }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as { tab: { id: string; type: string; title: string; pid?: number; cwd: string; model?: string } }
      this.dispatchEvent(new CustomEvent('tab-created', {
        detail: { tab: data.tab },
        bubbles: true,
        composed: true,
      }))
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
    } catch (err) {
      this.loading = false
      alert(`Failed: ${(err as Error).message}`)
    }
  }

  render(): unknown {
    return html`
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <div class="header">
          <span>New Tab</span>
          <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>×</button>
        </div>

        <div class="body">
          <div class="mode-tabs">
            <div class="mode-tab ${classMap({ active: this.mode === 'cli' })}" @click=${() => (this.mode = 'cli')}>Resume session</div>
            <div class="mode-tab ${classMap({ active: this.mode === 'spawn' })}" @click=${() => (this.mode = 'spawn')}>New terminal</div>
          </div>

          ${when(this.mode === 'cli', () => html`
            <div class="section-label">Recent conversations</div>
            ${this.loading
              ? html`<div class="empty">Loading sessions…</div>`
              : this.cliSessions.length === 0
                ? html`<div class="empty">No previous sessions found</div>`
                : html`
                  <div class="session-list">
                    ${this.cliSessions.map((s) => {
                      const isSelected = this.selectedCliSession === s.id
                      const displayTitle = s.slug || this.humanizeProject(s.project)
                      return html`
                        <div class="session-item ${classMap({ selected: isSelected })}"
                             @click=${() => {
                               if (isSelected) {
                                 this.selectedCliSession = null
                                 this.selectedCliCwd = null
                                 this.selectedCliSlug = null
                               } else {
                                 this.selectedCliSession = s.id
                                 this.selectedCliCwd = s.cwd
                                 this.selectedCliSlug = s.slug
                               }
                             }}>
                          <div class="title">${displayTitle}</div>
                          <div class="meta">
                            <span>${this.formatRelativeTime(s.modifiedAt)}</span>
                            <span>·</span>
                            <span>${(s.size / 1024).toFixed(1)} KB</span>
                          </div>
                          <div class="cwd">${s.cwd ?? '—'}</div>
                        </div>
                      `
                    })}
                  </div>
                `}
          `)}

          ${when(this.mode === 'spawn', () => html`
            <div class="field">
              <div class="section-label">Working directory</div>
              <div style="display:flex;gap:6px">
                <input
                  class="field-input mono"
                  style="flex:1"
                  .value=${this.cwd}
                  @input=${(e: Event) => (this.cwd = (e.target as HTMLInputElement).value)}
                  placeholder=${this.homeDir}
                />
                <button style="padding:6px 12px;background:#2a2a2a;border:1px solid #2a2a2a;border-radius:6px;color:#888;cursor:pointer;font-size:12px;white-space:nowrap"
                        @click=${() => (this.showFilePicker = true)}>Browse</button>
              </div>
            </div>

            <div class="field">
              <div class="section-label">Model</div>
              <select class="field-input" @change=${(e: Event) => (this.model = (e.target as HTMLSelectElement).value)}>
                ${this.models.length > 0
                  ? this.models.map((m) => html`<option value=${m.id} ?selected=${m.id === this.model}>${m.name}</option>`)
                  : html`<option value="ultra/glm-5.2">ultra/glm-5.2</option>`}
              </select>
            </div>

            <div class="field">
              <div class="section-label">Title (optional)</div>
              <input
                class="field-input"
                .value=${this.tabTitle}
                @input=${(e: Event) => (this.tabTitle = (e.target as HTMLInputElement).value)}
                placeholder="e.g. Frontend work, Backend tests…"
              />
            </div>
          `)}
        </div>

        <div class="actions">
          <button class="btn btn-secondary" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>Cancel</button>
          <button class="btn btn-primary" ?disabled=${this.loading || (this.mode === 'cli' && !this.selectedCliSession)} @click=${this.createTab}>
            ${this.loading ? 'Opening…' : (this.mode === 'cli' ? 'Resume' : 'Open terminal')}
          </button>
        </div>
      </div>
      ${when(this.showFilePicker, () => html`
        <vc-file-picker
          .initialPath=${this.cwd}
          ?showFiles=${false}
          title="Select working directory"
          @close=${() => (this.showFilePicker = false)}
          @select=${(e: CustomEvent) => {
            this.cwd = e.detail.path
            this.showFilePicker = false
          }}
        ></vc-file-picker>
      `)}
    `
  }
}
