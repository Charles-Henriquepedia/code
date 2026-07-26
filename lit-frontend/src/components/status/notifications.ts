import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import { classMap } from 'lit/directives/class-map.js'
import type { Notification } from '../../types.js'

@customElement('vc-notifications')
export class VcNotifications extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 0 0 4px;
      min-height: 0;
    }
    .notif {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      animation: slideIn .2s ease-out;
    }
    .notif.low { color: var(--text-secondary, #888); }
    .notif.medium { color: var(--warning, #f59e0b); background: rgba(245, 158, 11, .1); }
    .notif.high { color: var(--error, #ef4444); background: rgba(239, 68, 68, .1); }
    .notif.immediate { color: var(--error, #ef4444); background: rgba(239, 68, 68, .15); font-weight: 600; }
    @keyframes slideIn {
      from { transform: translateY(-4px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `

  @property({ type: Array }) items: Notification[] = []

  render(): unknown {
    return html`
      ${repeat(
        this.items,
        (n) => n.id,
        (n) => html`<div class="notif ${classMap({ [n.level]: true })}">${n.text}</div>`,
      )}
    `
  }
}
