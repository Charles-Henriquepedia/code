import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'
import type { ToolResultBlock } from '../../types.js'

const PREVIEW_LINES = 8
const PREVIEW_CHARS = 2000

@customElement('vc-message-tool-result')
export class VcMessageToolResult extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 0 4px 24px;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 4px;
      cursor: pointer;
      font-size: 12px;
      color: var(--text-secondary, #888);
      user-select: none;
    }
    .header:hover { color: var(--text-primary, #e5e5e5); }
    .arrow { transition: transform .15s; display: inline-block; width: 12px; }
    .arrow.open { transform: rotate(90deg); }
    .content {
      font-family: monospace;
      font-size: 12px;
      padding: 8px;
      background: var(--bg-tertiary, #252525);
      border-radius: 4px;
      margin-top: 4px;
      white-space: pre-wrap;
      word-break: break-word;
      overflow-wrap: anywhere;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: auto;
    }
    .content.error { color: var(--error, #ef4444); }
    .truncate {
      padding: 4px 8px;
      font-size: 11px;
      color: #888;
      background: #1a1a1a;
      border-top: 1px solid #2a2a2a;
      border-radius: 0 0 4px 4px;
      cursor: pointer;
      font-style: italic;
    }
    .truncate:hover { color: #818cf8; }
    .meta {
      font-size: 11px;
      color: #666;
      font-family: monospace;
      margin-left: 4px;
    }
  `

  @property({ type: Object }) block!: ToolResultBlock
  @state() private open = true
  @state() private expanded = false

  render(): unknown {
    const content = typeof this.block.content === 'string'
      ? this.block.content
      : JSON.stringify(this.block.content, null, 2)

    const allLines = content.split('\n')
    const totalLines = allLines.length
    const isError = !!this.block.is_error

    // Truncation logic
    const isLong = totalLines > PREVIEW_LINES || content.length > PREVIEW_CHARS
    const previewText = isLong
      ? allLines.slice(0, PREVIEW_LINES).join('\n') + (totalLines > PREVIEW_LINES ? '\n' : '')
      : content

    return html`
      <div class="header" @click=${() => (this.open = !this.open)}>
        <span class="arrow ${classMap({ open: this.open })}">▶</span>
        <span>${isError ? 'Error' : 'Result'}</span>
        <span class="meta">${totalLines} line${totalLines !== 1 ? 's' : ''}${isLong ? ' · truncated' : ''}</span>
      </div>
      ${when(this.open, () => html`
        <div class="content ${classMap({ error: isError })}">${this.expanded || !isLong ? content : previewText}</div>
        ${isLong && !this.expanded ? html`
          <div class="truncate" @click=${() => (this.expanded = true)}>
            ... ${totalLines - PREVIEW_LINES} more lines (click to expand)
          </div>
        ` : ''}
      `)}
    `
  }
}
