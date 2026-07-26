import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import './messages/message-list.js'
import './streaming/streaming-text.js'
import './streaming/thinking-block.js'
import './status/spinner.js'
import type { Message } from '../types.js'

@customElement('vc-main')
export class VcMain extends LitElement {
  static styles = css`
    :host {
      flex: 1;
      overflow-y: auto;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
  `

  @property({ type: Array }) messages: Message[] = []
  @property() streamingText = ''
  @property() streamingThinking = ''
  @property({ type: Boolean }) isProcessing = false

  private isNearBottom = true
  private SCROLL_THRESHOLD = 80 // px from bottom

  firstUpdated(): void {
    this.addEventListener('scroll', () => {
      const threshold = this.scrollHeight - this.clientHeight - this.SCROLL_THRESHOLD
      this.isNearBottom = this.scrollTop >= threshold
    })
  }

  updated(): void {
    if (this.isNearBottom) {
      this.scrollTop = this.scrollHeight
    }
  }

  render(): unknown {
    return html`
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
  }
}
