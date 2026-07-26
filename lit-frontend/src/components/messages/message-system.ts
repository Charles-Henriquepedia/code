import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { SystemMessage } from '../../types.js'

@customElement('vc-message-system')
export class VcMessageSystem extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 32px;
      color: var(--text-secondary, #888);
      font-size: 12px;
      font-style: italic;
    }
    .marker {
      color: var(--accent, #818cf8);
      font-style: normal;
      margin-right: 4px;
    }
  `

  @property({ type: Object }) message!: SystemMessage

  render(): unknown {
    const text = (this.message.content?.[0] as { text?: string } | undefined)?.text ?? this.message.text ?? ''
    const lines = text.split('\n').filter(Boolean)
    return html`<div><span class="marker">※</span>${lines.map((l) => html`<div>${l}</div>`)}</div>`
  }
}
