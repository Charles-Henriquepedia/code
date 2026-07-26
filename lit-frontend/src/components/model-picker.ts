import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'

interface ModelOption {
  id: string
  name: string
  contextWindow?: number
}

@customElement('vc-model-picker')
export class VcModelPicker extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      z-index: 200;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0,0,0,.5);
    }
    .picker {
      background: #1a1a1a;
      border: 1px solid #2a2a2a;
      border-radius: 10px;
      width: 420px;
      max-height: 70vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 12px 40px rgba(0,0,0,.5);
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 16px;
      border-bottom: 1px solid #2a2a2a;
      font-weight: 600;
      font-size: 13px;
    }
    .close-btn {
      background: none; border: none;
      color: #666; cursor: pointer; font-size: 18px; line-height: 1;
    }
    .close-btn:hover { color: #e5e5e5; }
    .body { display: flex; flex-direction: column; min-height: 0; }

    .filter {
      padding: 8px 16px;
      background: #0d0d0d;
      border-bottom: 1px solid #2a2a2a;
    }
    .filter-input {
      width: 100%;
      background: #0a0a0a;
      border: 1px solid #2a2a2a;
      color: #e5e5e5;
      font-size: 12px;
      padding: 6px 10px;
      border-radius: 4px;
      box-sizing: border-box;
    }
    .filter-input:focus { border-color: #6366f1; outline: none; }

    .list {
      overflow-y: auto;
      max-height: 360px;
      padding: 4px 0;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 13px;
    }
    .item:hover, .item.selected { background: #222; }
    .item.current { background: #1e1b4b; }
    .item .name { color: #e5e5e5; font-weight: 500; }
    .item .id { color: #666; font-family: 'Menlo', 'Monaco', monospace; font-size: 11px; }
    .item .ctx { color: #666; font-size: 11px; }
    .item .meta { margin-left: auto; display: flex; align-items: center; gap: 8px; }
    .item .check { color: #22c55e; }
    .empty { padding: 32px 16px; text-align: center; color: #666; font-size: 12px; }
  `

  @property({ type: Array }) models: ModelOption[] = []
  @property() current = ''

  @state() private filter = ''
  @state() private selectedIdx = 0

  async connectedCallback(): Promise<void> {
    super.connectedCallback()
    if (this.models.length === 0) {
      try {
        const res = await fetch('/api/v1/models')
        const data = await res.json() as { models: ModelOption[] }
        this.models = data.models ?? []
      } catch { /* ignore */ }
    }
    this.focusFilter()
  }

  private focusFilter(): void {
    requestAnimationFrame(() => {
      const input = this.renderRoot.querySelector('.filter-input') as HTMLInputElement
      if (input) input.focus()
    })
  }

  private get filteredModels(): ModelOption[] {
    if (!this.filter) return this.models
    const q = this.filter.toLowerCase()
    return this.models.filter(m =>
      m.name.toLowerCase().includes(q) || m.id.toLowerCase().includes(q)
    )
  }

  private selectModel(m: ModelOption): void {
    this.dispatchEvent(new CustomEvent('select', {
      detail: { model: m.id, modelInfo: m },
      bubbles: true,
      composed: true,
    }))
  }

  private onKeyDown(e: KeyboardEvent): void {
    const items = this.filteredModels
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      this.selectedIdx = Math.min(this.selectedIdx + 1, items.length - 1)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      this.selectedIdx = Math.max(this.selectedIdx - 1, 0)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[this.selectedIdx]
      if (item) this.selectModel(item)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
    }
  }

  private formatContext(ctx: number | undefined): string {
    if (!ctx) return ''
    if (ctx >= 1_000_000) return `${(ctx / 1_000_000).toFixed(0)}M ctx`
    if (ctx >= 1_000) return `${(ctx / 1_000).toFixed(0)}K ctx`
    return `${ctx} ctx`
  }

  render(): unknown {
    return html`
      <div class="picker" @click=${(e: Event) => e.stopPropagation()}>
        <div class="header">
          <span>Select model</span>
          <button class="close-btn" @click=${() => this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))}>×</button>
        </div>

        <div class="body">
          <div class="filter">
            <input
              class="filter-input"
              placeholder="Filter models…"
              .value=${this.filter}
              @input=${(e: Event) => {
                this.filter = (e.target as HTMLInputElement).value
                this.selectedIdx = 0
              }}
              @keydown=${this.onKeyDown}
            />
          </div>

          <div class="list" @click=${(e: Event) => e.stopPropagation()}>
            ${when(this.filteredModels.length === 0,
              () => html`<div class="empty">No models available</div>`,
              () => this.filteredModels.map((m, idx) => {
                const isCurrent = m.id === this.current
                return html`
                  <div class="item ${classMap({ selected: idx === this.selectedIdx, current: isCurrent })}"
                       @click=${() => this.selectModel(m)}
                       @mouseenter=${() => (this.selectedIdx = idx)}>
                    ${isCurrent ? html`<span class="check">✓</span>` : html`<span style="width:14px"></span>`}
                    <span class="name">${m.name}</span>
                    <span class="id">${m.id}</span>
                    <span class="meta">
                      ${m.contextWindow ? html`<span class="ctx">${this.formatContext(m.contextWindow)}</span>` : ''}
                    </span>
                  </div>
                `
              })
            )}
          </div>
        </div>
      </div>
    `
  }
}
