import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import type { AssistantMessage, ContentBlock } from '../../types.js'
import '../shared/markdown.js'
import './message-thinking.js'
import './message-tool-use.js'
import './message-tool-result.js'

@customElement('vc-message-assistant')
export class VcMessageAssistant extends LitElement {
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
      color: var(--success, #22c55e);
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
    .meta {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 2px;
      font-size: 10px;
      color: var(--text-secondary, #888);
    }
    .meta .streaming {
      color: var(--accent, #818cf8);
      animation: pulse 1.5s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50% { opacity: 1; }
    }
  `

  @property({ type: Object }) message!: AssistantMessage

  render(): unknown {
    const m = this.message
    if (!m) return html``
    const status = (m as any).status
    const toolDuration = (m as any).toolDuration as number | undefined
    const blocks = (m.content ?? []).filter((b: ContentBlock) => {
      if (!b) return false
      if (b.type === 'text') return !!(b.text && b.text.trim())
      if (b.type === 'thinking') return !!(b.thinking && b.thinking.trim())
      if (b.type === 'tool_use') return !!b.name
      return false
    })
    const hasContent = blocks.length > 0
    // Consolidate multiple thinking blocks into a single collapsed view
    const thinkingBlocks = blocks.filter((b: ContentBlock) => b.type === 'thinking') as Array<{ type: 'thinking'; thinking: string }>
    const nonThinkingBlocks = blocks.filter((b: ContentBlock) => b.type !== 'thinking')
    const consolidatedThinking = thinkingBlocks.length > 0
      ? thinkingBlocks.map((b) => b.thinking).join('\n\n')
      : ''
    return html`
      <div class="row">
        <span class="prefix">●</span>
        <div class="content">
          <div class="meta">
            ${when(status === 'streaming' || !hasContent, () => html`<span class="streaming">${!hasContent ? 'thinking...' : 'streaming'}</span>`)}
          </div>
          ${hasContent ? nonThinkingBlocks.map((b: ContentBlock) => this.renderBlock(b, toolDuration)) : ''}
          ${consolidatedThinking ? html`<vc-message-thinking .thinking=${consolidatedThinking}></vc-message-thinking>` : ''}
        </div>
      </div>
    `
  }

  private renderBlock(block: ContentBlock, toolDuration?: number): unknown {
    if (!block) return ''
    switch (block.type) {
      case 'text':
        return html`<vc-markdown .content=${block.text ?? ''}></vc-markdown>`
      case 'tool_use':
        return html`<vc-message-tool-use .block=${block} .toolDuration=${toolDuration}></vc-message-tool-use>`
      case 'tool_result':
        return html`<vc-message-tool-result .block=${block}></vc-message-tool-result>`
      default:
        return ''
    }
  }
}
