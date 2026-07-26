import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import './input/prompt-input.js'
import './status/notifications.js'
import './status/status-line.js'
import type { Command, Notification } from '../types.js'

@customElement('vc-footer')
export class VcFooter extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      border-top: 1px solid var(--border, #2a2a2a);
      background: var(--bg-secondary, #1a1a1a);
      padding: 12px 16px 8px;
      flex-shrink: 0;
      gap: 6px;
    }
  `

  @property({ type: Array }) commands: Command[] = []
  @property() mode: 'prompt' | 'bash' = 'prompt'
  @property({ type: Boolean }) disabled = false
  @property({ type: Array }) notifications: Notification[] = []
  @property() permissionMode = 'acceptEdits'

  private get permissionLabel(): string {
    const labels: Record<string, string> = {
      default: 'default',
      acceptEdits: 'edit',
      plan: 'plan',
      bypassPermissions: 'bypass',
    }
    return labels[this.permissionMode] ?? this.permissionMode
  }

  private get permissionColor(): string {
    const colors: Record<string, string> = {
      default: '#888',
      acceptEdits: '#22c55e',
      plan: '#818cf8',
      bypassPermissions: '#f59e0b',
    }
    return colors[this.permissionMode] ?? '#888'
  }

  render(): unknown {
    return html`
      <vc-notifications .items=${this.notifications}></vc-notifications>
      <vc-prompt-input
        .commands=${this.commands}
        .mode=${this.mode}
        .disabled=${this.disabled}
      ></vc-prompt-input>
      <vc-status-line
        .text=${`▶▶ ${this.permissionLabel} permissions on (shift+tab to cycle)`}
        .color=${this.permissionColor}
      ></vc-status-line>
    `
  }
}
