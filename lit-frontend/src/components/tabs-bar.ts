import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { repeat } from 'lit/directives/repeat.js'
import { tabStore, type TabState } from '../state/tab-store.js'

@customElement('vc-tabs-bar')
export class VcTabsBar extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      background: var(--bg-secondary, #222);
      border-bottom: 1px solid var(--border, #444);
      height: 36px;
      flex-shrink: 0;
      padding: 0 4px;
    }
    .tab-list {
      display: flex;
      align-items: center;
      flex: 1;
      overflow-x: auto;
      gap: 4px;
    }
    .tab-list::-webkit-scrollbar { height: 0; }
    .tab {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-size: 12px;
      color: var(--text-secondary, #888);
      border-right: 1px solid var(--border, #444);
      cursor: pointer;
      white-space: nowrap;
      min-width: 80px;
      max-width: 160px;
      user-select: none;
      transition: background .1s;
      position: relative;
    }
    .tab:hover { background: var(--bg-tertiary, #333); }
    .tab.active {
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #e5e5e5);
      border-bottom: 2px solid var(--accent, #818cf8);
    }
    .tab .status-dot {
      width: 6px; height: 6px; border-radius: 50%;
      background: var(--success, #22c55e);
      flex-shrink: 0;
    }
    .tab .status-dot.running { background: var(--accent, #818cf8); animation: pulse 1s infinite; }
    .tab .status-dot.error { background: var(--error, #ef4444); }
    .tab .title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .tab .close {
      font-size: 10px;
      opacity: 0;
      border: none;
      background: none;
      color: var(--text-secondary, #888);
      cursor: pointer;
      padding: 0 2px;
    }
    .tab:hover .close { opacity: 1; }
    .tab .close:hover { color: var(--error, #ef4444); }
    .new-tab-btn {
      padding: 4px 10px;
      font-size: 16px;
      color: var(--text-secondary, #888);
      cursor: pointer;
      border: none;
      background: none;
      font-weight: 600;
      flex-shrink: 0;
    }
    .new-tab-btn:hover { color: var(--accent, #818cf8); }
    .tab-type-badge {
      font-size: 9px;
      padding: 1px 4px;
      border-radius: 3px;
      background: var(--bg-tertiary, #333);
      color: var(--text-secondary, #888);
      margin-left: auto;
    }
    .tab-type-badge.chat { color: var(--accent, #818cf8); }
    .tab-type-badge.term { color: var(--success, #22c55e); }
    .tab-type-badge.attach { color: var(--warning, #f59e0b); }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .4; }
    }
  `

  @state() private tabs: TabState[] = []
  @state() private activeId: string | null = null

  private unsubscribe: () => void = () => {}

  connectedCallback(): void {
    super.connectedCallback()
    this.unsubscribe = tabStore.subscribe(() => {
      this.tabs = tabStore.getTabs()
      this.activeId = tabStore.getActiveId()
    })
  }

  disconnectedCallback(): void {
    this.unsubscribe()
    super.disconnectedCallback()
  }

  private selectTab(id: string): void {
    tabStore.setActive(id)
    this.dispatchEvent(new CustomEvent('tab-selected', { detail: { id }, bubbles: true, composed: true }))
  }

  private closeTab(e: Event, id: string): void {
    e.stopPropagation()
    this.dispatchEvent(new CustomEvent('tab-close', { detail: { id }, bubbles: true, composed: true }))
    tabStore.remove(id)
  }

  private newTab(): void {
    this.dispatchEvent(new CustomEvent('new-tab', { bubbles: true, composed: true }))
  }

  render(): unknown {
    return html`
      <div class="tab-list">
        ${repeat(
          this.tabs,
          (t) => t.id,
          (t) => html`
            <div class="tab ${classMap({ active: this.activeId === t.id })}" @click=${() => this.selectTab(t.id)}>
              <span class="status-dot ${classMap({ running: t.isProcessing, error: t.state === 'error' })}"></span>
              <span class="title">${t.title}</span>
              <span class="tab-type-badge ${t.type === 'sdk' ? 'chat' : t.type === 'pty' ? 'term' : t.type}">${t.type === 'sdk' ? 'chat' : t.type === 'pty' ? 'term' : t.type}</span>
              <button class="close" @click=${(e: Event) => this.closeTab(e, t.id)}>✕</button>
            </div>
          `,
        )}
      </div>
      <button class="new-tab-btn" @click=${this.newTab} title="New Tab">+</button>
    `
  }
}
