import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import type { UserMessage, ContentBlock } from '../../types.js'
import '../shared/markdown.js'

@customElement('vc-message-user')
export class VcMessageUser extends LitElement {
  static styles = css`
    :host { display: block; padding: 4px 16px; }
    .row {
      display: flex;
      gap: 8px;
      align-items: flex-start;
      line-height: 1.55;
    }
    .prefix {
      font-size: 13px;
      font-weight: 600;
      color: #4f46e5;
      flex-shrink: 0;
      font-family: monospace;
      margin-top: 2px;
      width: 20px;
      text-align: right;
    }
    .content {
      flex: 1;
      min-width: 0;
    }
    .content ::slotted(vc-markdown),
    .content ::part(markdown) { font-size: 14px; }
    .image { max-width: 100%; border-radius: 6px; margin: 4px 0; }
  `

  @property({ type: Object }) message!: UserMessage

  render(): unknown {
    const m = this.message
    if (!m) return html``
    return html`
      <div class="row">
        <span class="prefix">&gt;</span>
        <div class="content">
          ${(m.content ?? []).map((block: ContentBlock) => this.renderBlock(block))}
        </div>
      </div>
    `
  }

  private renderBlock(block: ContentBlock): unknown {
    if (!block) return ''
    switch (block.type) {
      case 'text':
        return html`<vc-markdown .content=${block.text ?? ''}></vc-markdown>`
      case 'image':
        return html`<img class="image" src=${block.source} alt="user image" />`
      case 'tool_result':
        return html`<vc-message-tool-result .block=${block}></vc-message-tool-result>`
      default:
        return ''
    }
  }
}
