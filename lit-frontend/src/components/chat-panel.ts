import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import './messages/message-list.js'
import './streaming/streaming-text.js'
import './streaming/thinking-block.js'
import './status/spinner.js'
import './footer.js'
import './tasks-list.js'
import type { Message } from '../types.js'
import type { CommandInfo, Notification } from '../types.js'

@customElement('vc-chat-panel')
export class VcChatPanel extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      min-height: 0;
      background: #0d0d0d;
      border-radius: 4px;
      overflow: hidden;
    }
    .panel-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 12px;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
      flex-shrink: 0;
    }
    .panel-header .left {
      display: flex;
      align-items: center;
      gap: 8px;
      min-width: 0;
      flex: 1;
    }
    .title {
      font-size: 12px;
      font-weight: 600;
      color: #e5e5e5;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .model-badge {
      font-size: 10px;
      font-family: monospace;
      background: #2a2a2a;
      color: #818cf8;
      padding: 2px 6px;
      border-radius: 3px;
      cursor: pointer;
      white-space: nowrap;
    }
    .model-badge:hover { background: #3a3a3a; }
    .status {
      font-size: 10px;
      color: #888;
      font-family: monospace;
    }
    .status.perm {
      padding: 2px 6px;
      border: 1px solid #444;
      border-radius: 3px;
      font-weight: 600;
      background: rgba(0,0,0,.2);
    }
    .context-meter {
      position: relative;
      width: 80px;
      height: 14px;
      background: #1f1f1f;
      border: 1px solid #2a2a2a;
      border-radius: 3px;
      overflow: hidden;
      flex-shrink: 0;
    }
    .context-bar {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      transition: width .2s ease;
    }
    .context-label {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 9px;
      font-weight: 600;
      color: #fff;
      font-family: monospace;
      text-shadow: 0 1px 2px rgba(0,0,0,.6);
    }
    .chat-area {
      flex: 1;
      overflow-y: auto;
      padding: 8px 0;
      min-height: 0;
    }
    .empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #444;
      font-size: 12px;
      padding: 20px;
    }
  `

  @property({ type: Array }) messages: Message[] = []
  @property() streamingText = ''
  @property() streamingThinking = ''
  @property({ type: Boolean }) isProcessing = false
  @property() sessionTitle = 'untitled'
  @property() model = 'ultra/glm-5.2'
  @property() cwd = '/'
  @property({ type: Array }) models: any[] = []
  @property({ type: Array }) tasks: Array<{ id: string; subject: string; status: string }> = []
  @property() contextUsed = 0
  @property() contextLimit = 0
  @property() inputTokens = 0
  @property() outputTokens = 0
  @property() permissionMode = 'acceptEdits'
  @property({ type: Array }) commands: CommandInfo[] = []
  @property() mode: 'prompt' | 'bash' = 'prompt'
  @property({ type: Array }) notifications: Notification[] = []

  private isNearBottom = true
  private chatArea?: HTMLElement
  private SCROLL_THRESHOLD = 60

  firstUpdated(): void {
    this.chatArea = this.renderRoot.querySelector('.chat-area') as HTMLElement
    // Initial scroll to bottom — use rAF to ensure DOM is fully laid out
    requestAnimationFrame(() => {
      if (this.chatArea) {
        this.chatArea.scrollTop = this.chatArea.scrollHeight
      }
    })
  }

  private onScroll(): void {
    if (!this.chatArea) return
    const threshold = this.chatArea.scrollHeight - this.chatArea.clientHeight - this.SCROLL_THRESHOLD
    this.isNearBottom = this.chatArea.scrollTop >= threshold
  }

  updated(): void {
    if (this.chatArea && this.isNearBottom) {
      this.chatArea.scrollTop = this.chatArea.scrollHeight
    }
  }

  private onModelClick(): void {
    this.dispatchEvent(new CustomEvent('open-model-picker', { bubbles: true, composed: true }))
  }

  private cyclePermissionMode(): void {
    const modes = ['default', 'acceptEdits', 'plan', 'bypassPermissions'] as const
    const idx = modes.indexOf(this.permissionMode as typeof modes[number])
    const next = modes[(idx + 1) % modes.length]
    this.dispatchEvent(new CustomEvent('permission-change', {
      detail: { mode: next },
      bubbles: true, composed: true,
    }))
  }

  private onSubmit(e: CustomEvent): void {
    this.dispatchEvent(new CustomEvent('submit', { detail: e.detail, bubbles: true, composed: true }))
  }

  private onInterrupt(): void {
    this.dispatchEvent(new CustomEvent('interrupt', { bubbles: true, composed: true }))
  }

  private onModeChange(e: CustomEvent): void {
    this.dispatchEvent(new CustomEvent('mode-change', { detail: e.detail, bubbles: true, composed: true }))
  }

  private get displayModel(): string {
    return this.model.replace(/^ultra\//, '').replace(/^claude-/, 'claude-')
  }

  get contextPercent(): number {
    if (!this.contextLimit) return 0
    return Math.round((this.inputTokens / this.contextLimit) * 100)
  }

  get permissionLabel(): string {
    const labels: Record<string, string> = {
      'acceptEdits': 'Edit',
      'bypassPermissions': 'Bypass',
      'plan': 'Plan',
      'default': 'Default',
    }
    return labels[this.permissionMode] ?? this.permissionMode
  }

  get permissionColor(): string {
    const colors: Record<string, string> = {
      'bypassPermissions': '#ef4444',
      'plan': '#f59e0b',
      'default': '#3b82f6',
      'acceptEdits': '#22c55e',
    }
    return colors[this.permissionMode] ?? '#888'
  }

  get contextBarColor(): string {
    const pct = this.contextPercent
    if (pct >= 90) return '#ef4444'
    if (pct >= 70) return '#f59e0b'
    return '#6366f1'
  }

  render(): unknown {
    return html`
      <div class="panel-header">
        <div class="left">
          <span class="title">${this.sessionTitle}</span>
          <span class="model-badge" @click=${this.onModelClick} title="Change model">${this.displayModel}</span>
          ${when(this.contextLimit > 0, () => html`
            <div class="context-meter" title="${this.inputTokens.toLocaleString()} / ${this.contextLimit.toLocaleString()} tokens">
              <div class="context-bar" style="width:${Math.min(this.contextPercent, 100)}%; background:${this.contextBarColor}"></div>
              <span class="context-label">${this.contextPercent}%</span>
            </div>
          `)}
          <span class="status perm" style="color:${this.permissionColor}; border-color:${this.permissionColor}; cursor:pointer" @click=${this.cyclePermissionMode} title="Click or Shift+Tab to cycle permission mode">${this.permissionLabel}</span>
          <span class="status">${this.isProcessing ? 'streaming' : 'ready'}</span>
        </div>
      </div>
      <div class="chat-area" @scroll=${this.onScroll}>
        ${when(this.messages.length === 0 && !this.streamingText,
          () => html`<div class="empty">No messages yet</div>`,
          () => html`
            <vc-message-list .messages=${this.messages}></vc-message-list>
            ${when(this.streamingThinking, () => html`
              <vc-thinking-block .thinking=${this.streamingThinking}></vc-thinking-block>
            `)}
            ${when(this.streamingText, () => html`
              <vc-streaming-text .text=${this.streamingText}></vc-streaming-text>
            `)}
            ${when(this.isProcessing && !this.streamingText, () => html`
              <vc-spinner></vc-spinner>
            `)}
          `
        )}
      </div>
      ${when(this.tasks.length > 0, () => html`
        <vc-tasks-list .tasks=${this.tasks}></vc-tasks-list>
      `)}
      <vc-footer
        .commands=${this.commands}
        .mode=${this.mode}
        .cwd=${this.cwd}
        .disabled=${this.isProcessing}
        .notifications=${this.notifications}
        .permissionMode=${this.permissionMode}
        @submit=${this.onSubmit}
        @interrupt=${this.onInterrupt}
        @mode-change=${this.onModeChange}
        @cycle-permission=${this.cyclePermissionMode}
      ></vc-footer>
    `
  }
}
