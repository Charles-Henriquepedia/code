import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import './message-user.js'
import './message-assistant.js'
import './message-system.js'
import type { Message } from '../../types.js'

@customElement('vc-message')
export class VcMessage extends LitElement {
  static styles = css`
    :host { display: block; }
  `

  @property({ type: Object }) message!: Message
  @property({ type: Boolean }) verbose = false

  render(): unknown {
    const m = this.message
    switch (m.role) {
      case 'user':
        return html`<vc-message-user .message=${m}></vc-message-user>`
      case 'assistant':
        return html`<vc-message-assistant .message=${m} .verbose=${this.verbose}></vc-message-assistant>`
      case 'system':
        return when(
          m.subtype === 'compact_boundary' || m.subtype === 'microcompact_boundary',
          () => html``,
          () => html`<vc-message-system .message=${m}></vc-message-system>`,
        )
      default:
        return html``
    }
  }
}
