import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'

@customElement('vc-header')
export class VcHeader extends LitElement {
  static styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 16px;
      background: var(--bg-secondary, #1a1a1a);
      border-bottom: 1px solid var(--border, #2a2a2a);
      font-size: 13px;
      flex-shrink: 0;
      height: 40px;
    }
    .left { display: flex; align-items: center; gap: 12px; }
    .logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .logo img { height: 20px; width: auto; }
    .logo-text {
      font-weight: 700;
      color: var(--text-primary, #e5e5e5);
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 14px;
      letter-spacing: -.3px;
    }
    .logo-text .sep { color: var(--accent, #818cf8); }
    .right { display: flex; align-items: center; gap: 8px; }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success, #22c55e);
    }
    .status-dot.disconnected { background: var(--error, #ef4444); }
    button {
      background: transparent;
      border: 1px solid var(--border, #2a2a2a);
      color: var(--text-primary, #e5e5e5);
      padding: 4px 8px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    button:hover { border-color: var(--accent, #818cf8); }
    .theme-btn {
      font-size: 14px;
      padding: 4px 8px;
      line-height: 1;
    }
  `

  @property({ type: Boolean }) connected = false
  @state() private theme: 'dark' | 'light' = 'dark'

  connectedCallback(): void {
    super.connectedCallback()
    const saved = localStorage.getItem('verboo-theme') as 'dark' | 'light' | null
    if (saved) {
      this.theme = saved
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      this.theme = 'light'
    }
    this.applyTheme()
  }

  private applyTheme(): void {
    document.documentElement.classList.toggle('light', this.theme === 'light')
    document.documentElement.classList.toggle('dark', this.theme === 'dark')
  }

  private toggleTheme(): void {
    this.theme = this.theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem('verboo-theme', this.theme)
    this.applyTheme()
    this.dispatchEvent(new CustomEvent('theme-change', {
      detail: { theme: this.theme },
      bubbles: true,
      composed: true,
    }))
  }

  render(): unknown {
    return html`
      <div class="left">
        <span class="logo">
          <img src="/verboo-logo-icon.png" alt="Verboo" />
          <span class="logo-text">verboo<span class="sep">:</span>code</span>
        </span>
      </div>
      <div class="right">
        <button class="theme-btn" @click=${this.toggleTheme} title="Toggle theme">
          ${this.theme === 'dark' ? '☀' : '☾'}
        </button>
        <button @click=${() => this.dispatchEvent(new CustomEvent('toggle-explorer', { bubbles: true, composed: true }))} title="Toggle explorer">📁</button>
        <button @click=${() => this.dispatchEvent(new CustomEvent('open-pairing', { bubbles: true, composed: true }))}>Pair</button>
        <span class=${classMap({ 'status-dot': true, disconnected: !this.connected })} title=${this.connected ? 'Connected' : 'Disconnected'}></span>
      </div>
    `
  }
}
