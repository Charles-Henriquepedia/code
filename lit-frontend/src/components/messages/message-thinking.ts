import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'

@customElement('vc-message-thinking')
export class VcMessageThinking extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 24px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 6px;
      cursor: pointer;
      font-size: 11px;
      color: var(--warning, #f59e0b);
      user-select: none;
      opacity: .8;
    }
    .header:hover { opacity: 1; }
    .thinking-label {
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: .5px;
      font-size: 10px;
    }
    .preview {
      color: var(--text-secondary, #888);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex: 1;
      min-width: 0;
    }
    .thinking-content {
      font-size: 12px;
      color: var(--text-secondary, #888);
      padding: 6px;
      border-left: 2px solid var(--warning, #f59e0b);
      margin-top: 4px;
      white-space: pre-wrap;
      font-family: monospace;
      max-height: 400px;
      overflow-y: auto;
    }
  `

  @property() thinking = ''
  @state() private open = false

  render(): unknown {
    const lines = this.thinking.split('\n')
    const preview = lines.join(' ').slice(0, 200) ?? ''

    return html`
      <div class="header" @click=${() => (this.open = !this.open)}>
        <span class="thinking-label">THINK</span>
        ${when(!this.open, () => html`<span class="preview">${preview}</span>`)}
      </div>
      ${when(this.open, () => html`
        <div class="thinking-content">${this.thinking}</div>
      `)}
    `
  }
}
