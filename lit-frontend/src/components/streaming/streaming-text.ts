import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('vc-streaming-text')
export class VcStreamingText extends LitElement {
  static styles = css`
    :host {
      display: flex;
      gap: 8px;
      padding: 8px 0;
    }
    .avatar {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: var(--success, #22c55e);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 600;
      flex-shrink: 0;
    }
    .content {
      flex: 1;
      line-height: 1.5;
    }
    .text {
      white-space: pre-wrap;
    }
    .cursor {
      display: inline-block;
      width: 8px;
      height: 16px;
      background: var(--accent, #818cf8);
      animation: blink 1s step-end infinite;
      vertical-align: text-bottom;
    }
    @keyframes blink {
      50% { opacity: 0; }
    }
  `

  @property() text = ''

  render(): unknown {
    return html`
      <div class="avatar">A</div>
      <div class="content">
        <div class="text">${this.text}<span class="cursor"></span></div>
      </div>
    `
  }
}
