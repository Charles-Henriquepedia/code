import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './message.js'
import type { Message } from '../../types.js'

@customElement('vc-message-list')
export class VcMessageList extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
  `

  @property({ type: Array }) messages: Message[] = []
  @property({ type: Boolean }) verbose = false

  render(): unknown {
    return html`
      ${repeat(
        this.messages,
        (m) => m.id,
        (m) => html`<vc-message .message=${m} .verbose=${this.verbose}></vc-message>`,
      )}
    `
  }
}
