import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('vc-thinking-block')
export class VcThinkingBlock extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 32px;
    }
    .thinking {
      font-size: 12px;
      color: var(--warning, #f59e0b);
      white-space: pre-wrap;
      font-family: monospace;
      border-left: 2px solid var(--warning, #f59e0b);
      padding: 4px 8px;
      min-height: 20px;
    }
    .dot:nth-child(1) { animation: dot 1.4s infinite; }
    .dot:nth-child(2) { animation: dot 1.4s .2s infinite; }
    .dot:nth-child(3) { animation: dot 1.4s .4s infinite; }
    @keyframes dot {
      0%, 20% { opacity: 0; }
      50% { opacity: 1; }
      80%, 100% { opacity: 0; }
    }
  `

  @property() thinking = ''

  render(): unknown {
    return html`
      <div class="thinking">
        ${this.thinking || html`<span class="dot">.</span><span class="dot">.</span><span class="dot">.</span>`}
      </div>
    `
  }
}
