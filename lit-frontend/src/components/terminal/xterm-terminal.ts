import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

@customElement('vc-xterm-terminal')
export class VcXtermTerminal extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-height: 0;
      background: #1a1a1a;
      position: relative;
    }
    #terminal-container {
      flex: 1;
      min-height: 0;
      padding: 4px;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(26, 26, 26, 0.85);
      color: #888;
      font-size: 14px;
      z-index: 10;
    }
    .overlay.error {
      color: #ef4444;
    }
  `

  @property({ type: String }) sessionId = ''
  @state() private connected = false
  @state() private errorMessage = ''
  @state() private stopped = false

  private terminal!: Terminal
  private fitAddon!: FitAddon
  private ws: WebSocket | null = null
  private shouldReconnect = true
  private reconnectAttempts = 0
  private maxReconnectAttempts = 10
  private resizeObserver: ResizeObserver | null = null

  firstUpdated(): void {
    this.terminal = new Terminal({
      theme: {
        background: '#1a1a1a',
        foreground: '#e5e5e5',
        cursor: '#818cf8',
        cursorAccent: '#1a1a1a',
        selectionBackground: '#334155',
        black: '#1a1a1a',
        red: '#ef4444',
        green: '#22c55e',
        yellow: '#eab308',
        blue: '#818cf8',
        magenta: '#c084fc',
        cyan: '#22d3ee',
        white: '#e5e5e5',
        brightBlack: '#444',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#818cf8',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#fff',
      },
      cursorBlink: true,
      cursorStyle: 'block',
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      fontSize: 13,
      allowTransparency: false,
      scrollback: 5000,
      allowProposedApi: true, // for selection clipboard API
    })

    this.fitAddon = new FitAddon()
    this.terminal.loadAddon(this.fitAddon)

    const container = this.shadowRoot?.getElementById('terminal-container')
    if (container) {
      this.terminal.open(container)
      // Small delay to let the container render before fitting
      setTimeout(() => this.fitAddon.fit(), 50)
    }

    this.connectWebSocket()

    // Handle terminal resize
    this.resizeObserver = new ResizeObserver(() => {
      this.fitAddon.fit()
      const dims = this.terminal?.cols && this.terminal?.rows
      if (dims && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          type: 'pty_resize',
          sessionId: this.sessionId,
          cols: this.terminal.cols,
          rows: this.terminal.rows,
        }))
      }
    })
    if (container) {
      this.resizeObserver.observe(container)
    }

    // Handle user input
    this.terminal.onData((data) => {
      if (this.ws?.readyState === WebSocket.OPEN && !this.stopped) {
        this.ws.send(JSON.stringify({
          type: 'pty_input',
          sessionId: this.sessionId,
          data,
        }))
      }
    })

    // Copy/paste: Ctrl+Shift+C / Ctrl+Shift+V
    this.terminal.attachCustomKeyEventHandler((e) => {
      if (e.type !== 'keydown') return true
      const isCtrlShift = e.ctrlKey && e.shiftKey
      if (isCtrlShift && e.key === 'C') {
        const selection = this.terminal.getSelection()
        if (selection) {
          navigator.clipboard?.writeText(selection).catch(() => {})
          return false
        }
      }
      if (isCtrlShift && e.key === 'V') {
        navigator.clipboard?.readText().then(text => {
          if (text && this.ws?.readyState === WebSocket.OPEN && !this.stopped) {
            this.ws.send(JSON.stringify({
              type: 'pty_input',
              sessionId: this.sessionId,
              data: text,
            }))
          }
        }).catch(() => {})
        return false
      }
      return true
    })
  }

  private connectWebSocket(): void {
    this.shouldReconnect = true
    this.reconnectAttempts = 0

    const wsOrigin = window.location.origin.replace(/^http/, 'ws')
    const url = `${wsOrigin}/api/v1/ws?session_id=${this.sessionId}`

    this.ws?.close()
    this.ws = new WebSocket(url)

    this.ws.onopen = () => {
      this.connected = true
      this.errorMessage = ''
      this.reconnectAttempts = 0
      setTimeout(() => this.fitAddon.fit(), 100)
    }

    this.ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data)
        if (data.type === 'pty_output' && data.data) {
          this.terminal.write(data.data)
        } else if (data.type === 'pty_stopped' || data.type === 'process_exit') {
          this.stopped = true
          this.terminal.write(`\r\n\x1b[90m[process exited with code ${data.exitCode ?? '?'}]\x1b[0m\r\n`)
        } else if (data.type === 'error') {
          this.errorMessage = data.error ?? 'WebSocket error'
        }
      } catch {
        // skip malformed messages
      }
    }

    this.ws.onclose = () => {
      this.connected = false
      if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++
        const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), 30000)
        setTimeout(() => this.connectWebSocket(), delay)
      }
    }

    this.ws.onerror = () => {
      this.errorMessage = 'Connection error'
    }
  }

  disconnectedCallback(): void {
    this.shouldReconnect = false
    this.ws?.close()
    this.ws = null
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.terminal?.dispose()
    super.disconnectedCallback()
  }

  private restart(): void {
    this.stopped = false
    this.errorMessage = ''
    this.terminal.reset()
    this.connectWebSocket()
  }

  render(): unknown {
    return html`
      <div id="terminal-container"></div>
      ${when(
        !this.connected || this.errorMessage || this.stopped,
        () => html`
          <div class="overlay ${this.errorMessage ? 'error' : ''} ${this.stopped ? '' : ''}" style="flex-direction:column;gap:12px">
            ${this.errorMessage
              ? html`<span>${this.errorMessage}</span>`
              : this.stopped
                ? html`<span style="color:#888">Terminal stopped</span>`
                : html`<span>${this.reconnectAttempts > 0 ? 'Reconnecting...' : 'Connecting...'}</span>`}
            ${when(this.stopped, () => html`
              <button @click=${this.restart}
                style="padding:6px 16px;border:1px solid #555;border-radius:4px;background:#2a2a2a;color:#e5e5e5;cursor:pointer;font-size:12px">
                Restart Terminal
              </button>
            `)}
          </div>
        `,
      )}
    `
  }
}
