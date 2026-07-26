import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('vc-status-line')
export class VcStatusLine extends LitElement {
  static styles = css`
    :host {
      display: block;
      font-size: 11px;
      color: var(--text-secondary, #888);
      padding: 2px 0 0;
      min-height: 16px;
    }
    .content {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `

  @property() text = ''
  @property() color = 'var(--text-secondary, #888)'

  render(): unknown {
    return html`<div class="content" style="color:${this.color}">${this.text || 'Ready'}</div>`
  }
}
