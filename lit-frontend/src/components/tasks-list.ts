import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { repeat } from 'lit/directives/repeat.js'

export type TaskStatus = 'pending' | 'active' | 'in_progress' | 'done' | 'completed' | 'blocked'

export interface Task {
  id: string
  subject: string
  status: TaskStatus
}

@customElement('vc-tasks-list')
export class VcTasksList extends LitElement {
  static styles = css`
    :host {
      display: block;
    }
    .summary-bar {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 4px 12px;
      background: #0d0d0d;
      border-top: 1px solid #2a2a2a;
      font-size: 11px;
      color: #888;
      font-family: monospace;
    }
    .summary-bar .toggle {
      cursor: pointer;
      user-select: none;
      color: #818cf8;
    }
    .summary-bar .toggle:hover { color: #b4b4fc; }
    .summary-bar .dot {
      display: inline-block;
      width: 6px;
      height: 6px;
      border-radius: 50%;
      margin-right: 4px;
    }
    .dot.done { background: #22c55e; }
    .dot.in_progress, .dot.active { background: #f59e0b; }
    .dot.pending { background: #6366f1; }
    .dot.blocked { background: #ef4444; }
    .panel {
      max-height: 200px;
      overflow-y: auto;
      background: #0a0a0a;
      border-top: 1px solid #2a2a2a;
      padding: 6px 12px;
    }
    .task {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 3px 0;
      font-size: 12px;
      font-family: monospace;
    }
    .task.done .subject { color: #666; text-decoration: line-through; }
    .task.in_progress .subject, .task.active .subject { color: #f59e0b; }
    .task.pending .subject { color: #e5e5e5; }
    .task.blocked .subject { color: #ef4444; }
    .task .id { color: #555; width: 40px; flex-shrink: 0; }
    .empty { padding: 12px; color: #555; font-size: 12px; font-style: italic; }
  `

  @property({ type: Array }) tasks: Task[] = []
  @property({ type: Boolean }) defaultExpanded = false

  @state() private expanded = false

  connectedCallback(): void {
    super.connectedCallback()
    this.expanded = this.defaultExpanded
  }

  get counts(): Record<TaskStatus, number> {
    const c: Record<TaskStatus, number> = { pending: 0, active: 0, in_progress: 0, done: 0, completed: 0, blocked: 0 }
    for (const t of this.tasks) c[t.status] = (c[t.status] ?? 0) + 1
    // Treat 'completed' as 'done'
    if (c.completed > 0) { c.done += c.completed; c.completed = 0 }
    return c
  }

  get percentComplete(): number {
    const total = this.tasks.length
    if (!total) return 0
    return Math.round((this.counts.done / total) * 100)
  }

  render(): unknown {
    const c = this.counts
    const total = this.tasks.length
    return html`
      <div class="summary-bar">
        <span class="toggle" @click=${() => (this.expanded = !this.expanded)}>
          ${this.expanded ? '▼' : '▶'} ${total} task${total !== 1 ? 's' : ''} (${c.done} done · ${(c.in_progress ?? 0) + (c.active ?? 0)} in progress · ${c.pending} open)
        </span>
        ${total > 0 ? html`
          <span class="progress-bar" style="flex:1;height:4px;background:#1f1f1f;border-radius:2px;overflow:hidden">
            <span style="display:block;height:100%;width:${this.percentComplete}%;background:#22c55e"></span>
          </span>
          <span style="font-size:10px;color:#666">${this.percentComplete}%</span>
        ` : ''}
      </div>
      ${when(this.expanded && total > 0, () => html`
        <div class="panel">
          ${repeat(this.tasks, (t) => t.id, (t) => html`
            <div class="task ${t.status}">
              <span class="id">${t.id.slice(0, 6)}</span>
              <span class="dot ${t.status}"></span>
              <span class="subject">${t.subject}</span>
            </div>
          `)}
        </div>
      `)}
      ${when(this.expanded && total === 0, () => html`
        <div class="panel">
          <div class="empty">No tasks tracked yet</div>
        </div>
      `)}
    `
  }
}
