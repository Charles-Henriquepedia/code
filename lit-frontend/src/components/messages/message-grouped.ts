import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'

@customElement('vc-message-grouped')
export class VcMessageGrouped extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 0;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-secondary, #888);
      user-select: none;
      padding: 2px 8px;
      border: 1px solid var(--border, #444);
      border-radius: 4px;
      background: var(--bg-tertiary, #333);
    }
    .header:hover { border-color: var(--accent, #818cf8); }
    .arrow { transition: transform .15s; font-size: 10px; }
    .arrow.open { transform: rotate(90deg); }
    .count { font-weight: 600; margin-left: auto; }
    .items { margin-top: 4px; padding-left: 16px; }
  `

  @property() label = 'Grouped actions'
  @property({ type: Number }) count = 0
  @state() private open = false

  render(): unknown {
    return html`
      <div class="header" @click=${() => (this.open = !this.open)}>
        <span class="arrow ${classMap({ open: this.open })}">▶</span>
        <span>${this.label}</span>
        <span class="count">${this.count}</span>
      </div>
      ${when(this.open, () => html`
        <div class="items"><slot></slot></div>
      `)}
    `
  }
}
