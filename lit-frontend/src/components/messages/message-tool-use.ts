import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import type { ToolUseBlock } from '../../types.js'

/**
 * Format a raw tool name into a CLI-friendly display name.
 * Examples:
 *   mcp__plugin_goal_goal__update_task → "plugin:goal:goal — update_task (MCP)"
 *   mcp__qda_kanban__create_card       → "qda-kanban — create_card (MCP)"
 *   Bash                                → "Bash"
 *   Agent                                → "Agent"
 */
function formatToolName(rawName: string): string {
  if (!rawName) return 'unknown'
  // MCP plugin tools: mcp__plugin_<server>__<tool>
  const pluginMatch = rawName.match(/^mcp__plugin_([a-zA-Z0-9_]+)__(.+)$/)
  if (pluginMatch) {
    const server = pluginMatch[1].replace(/_/g, ':').replace(/:/g, ':')
    const tool = pluginMatch[2]
    return `${server} — ${tool} (MCP)`
  }
  // MCP server tools: mcp__<server>__<tool>
  const mcpMatch = rawName.match(/^mcp__([a-zA-Z0-9_]+)__(.+)$/)
  if (mcpMatch) {
    const server = mcpMatch[1].replace(/_/g, '-')
    const tool = mcpMatch[2]
    return `${server} — ${tool} (MCP)`
  }
  return rawName
}

/**
 * Extract a short description from tool input for display.
 * For Agent: shows the description field.
 * For Bash: shows the command.
 * For others: shows first 60 chars of JSON.
 */
function formatToolPreview(name: string, input: unknown): string {
  if (!input || typeof input !== 'object') return ''
  const obj = input as Record<string, unknown>
  if (name === 'Agent' && typeof obj.description === 'string') {
    return obj.description
  }
  if (name === 'Bash' && typeof obj.command === 'string') {
    const cmd = obj.command.split('\n')[0].slice(0, 60)
    return cmd
  }
  if (name === 'Read' && typeof obj.file_path === 'string') {
    return obj.file_path
  }
  if (name === 'Edit' && typeof obj.file_path === 'string') {
    return obj.file_path
  }
  if (name === 'Write' && typeof obj.file_path === 'string') {
    return obj.file_path
  }
  if (name === 'Grep' && typeof obj.pattern === 'string') {
    return obj.pattern
  }
  if (name === 'Glob' && typeof obj.pattern === 'string') {
    return obj.pattern
  }
  // For MCP tools, show key fields
  const keys = Object.keys(obj).slice(0, 2)
  if (keys.length > 0) {
    const parts = keys.map(k => `${k}: ${JSON.stringify(obj[k]).slice(0, 40)}`)
    return parts.join(', ')
  }
  return JSON.stringify(obj).slice(0, 60)
}

@customElement('vc-message-tool-use')
export class VcMessageToolUse extends LitElement {
  static styles = css`
    :host {
      display: block;
      padding: 4px 0;
    }
    .tool-call {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      padding: 3px 8px;
      border: 1px solid var(--border, #333);
      border-radius: 4px;
      font-size: 12px;
      font-family: monospace;
      background: var(--bg-tertiary, #252525);
      margin: 1px 0;
      min-width: 0;
      max-width: 100%;
    }
    .tool-call.running { border-color: var(--accent, #6366f1); }
    .tool-call.done { border-color: var(--border, #444); }
    .tool-call.error { border-color: var(--error, #ef4444); }
    .tool-name { color: var(--text-primary, #e5e5e5); white-space: nowrap; }
    .tool-preview { color: var(--text-secondary, #777); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 11px; }
    .icon {
      width: 14px; height: 14px;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 9px; flex-shrink: 0; margin-top: 1px;
      border-radius: 3px;
      background: var(--bg-secondary, #333);
      color: var(--text-secondary, #888);
    }
    .icon.running { background: rgba(99,102,241,0.2); color: #818cf8; }
    .icon.done { background: rgba(34,197,94,0.15); color: #22c55e; }
    .icon.error { background: rgba(239,68,68,0.15); color: #ef4444; }
  `

  @property({ type: Object }) block!: ToolUseBlock
  @property() status: 'running' | 'done' | 'error' = 'done'
  @property({ type: Number }) toolDuration?: number
  @property({ type: Object }) result?: { content: string; is_error?: boolean }

  private get durationStr(): string {
    if (!this.toolDuration) return ''
    const ms = this.toolDuration
    if (ms < 1000) return `${ms}ms`
    return `${(ms / 1000).toFixed(1)}s`
  }

  render(): unknown {
    const classes = { 'tool-call': true, running: this.status === 'running', done: this.status === 'done', error: this.status === 'error' }
    const displayName = formatToolName(this.block.name)
    const preview = formatToolPreview(this.block.name, this.block.input)
    const iconChar = this.status === 'running' ? '>' : this.status === 'error' ? '!' : '\u25E6'
    return html`
      <div class=${classMap(classes)}>
        <span class="icon ${classMap({ running: this.status === 'running', done: this.status === 'done', error: this.status === 'error' })}">${iconChar}</span>
        <span class="tool-name" style=${this.status === 'running' ? 'color:var(--accent,#818cf8);' : ''}>${displayName}</span>
        ${preview ? html`<span class="tool-preview">${preview}</span>` : ''}
        ${this.durationStr ? html`<span class="tool-duration" style="margin-left:auto;font-size:10px;color:#666;white-space:nowrap">${this.durationStr}</span>` : ''}
      </div>
    `
  }
}
