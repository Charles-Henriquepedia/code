import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'

const FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']
const TIPS = [
  'Use /compact to manage context',
  'Press Ctrl+O for full transcript',
  'Type /help for available commands',
  'Use @ to reference files',
  'Press Ctrl+T to view tasks',
]

@customElement('vc-spinner')
export class VcSpinner extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 8px 0;
      color: var(--text-secondary, #888);
      font-size: 13px;
    }
    .row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .frame {
      width: 16px;
      text-align: center;
      color: var(--accent, #818cf8);
    }
    .verb { font-weight: 500; }
    .elapsed { font-size: 11px; }
    .tip { font-size: 11px; color: var(--text-secondary, #888); }
  `

  @property() mode = 'Working'
  @property({ type: Number }) elapsed = 0
  @property() tip?: string

  @state() private frameIdx = 0
  @state() private elapsedStr = '0s'
  private frameTimer: ReturnType<typeof setInterval> | null = null
  private elapsedTimer: ReturnType<typeof setInterval> | null = null

  connectedCallback(): void {
    super.connectedCallback()
    this.frameTimer = setInterval(() => {
      this.frameIdx = (this.frameIdx + 1) % FRAMES.length
    }, 120)
    const start = Date.now()
    this.elapsedTimer = setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000)
      this.elapsedStr = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`
    }, 1000)
  }

  disconnectedCallback(): void {
    if (this.frameTimer) clearInterval(this.frameTimer)
    if (this.elapsedTimer) clearInterval(this.elapsedTimer)
    super.disconnectedCallback()
  }

  render(): unknown {
    const tip = this.tip ?? TIPS[Math.floor(Math.random() * TIPS.length)]
    return html`
      <div class="row">
        <span class="frame">${FRAMES[this.frameIdx]}</span>
        <span class="verb">${this.mode}</span>
        <span class="dot">·</span>
        <span class="elapsed">${this.elapsedStr}</span>
      </div>
      <div class="tip">${tip}</div>
    `
  }
}
