import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import QRCode from 'qrcode'

@customElement('vc-pairing-dialog')
export class VcPairingDialog extends LitElement {
  static styles = css`
    :host {
      position: fixed;
      inset: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      background: rgba(0, 0, 0, 0.6);
    }
    .dialog {
      background: #1e1e1e;
      border: 1px solid #444;
      border-radius: 12px;
      padding: 24px;
      max-width: 360px;
      width: 90%;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    h3 { margin: 0; color: #e5e5e5; font-size: 16px; }
    .qr-container {
      background: white;
      padding: 12px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .qr-container canvas {
      width: 200px;
      height: 200px;
      image-rendering: pixelated;
    }
    .pair-url {
      font-size: 11px;
      color: #888;
      word-break: break-all;
      text-align: center;
      background: #2a2a2a;
      padding: 8px 12px;
      border-radius: 6px;
      max-width: 100%;
      user-select: all;
    }
    .actions { display: flex; gap: 8px; width: 100%; }
    .actions button {
      flex: 1;
      padding: 8px 16px;
      border: 1px solid #555;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
    }
    .btn-close { background: #333; color: #e5e5e5; }
    .btn-close:hover { background: #444; }
    .btn-copy { background: #4f46e5; color: white; border-color: #6366f1 !important; }
    .btn-copy:hover { background: #6366f1; }
    .copy-success { color: #22c55e; font-size: 12px; }
  `

  @state() private qrDataUrl = ''
  @state() private copySuccess = false

  @property() url = ''

  async firstUpdated(): Promise<void> {
    if (this.url) {
      try {
        this.qrDataUrl = await QRCode.toDataURL(this.url, {
          width: 256, margin: 2, color: { dark: '#000', light: '#fff' },
        })
      } catch (e) {
        console.error('QR generation failed:', e)
      }
    }
  }

  private handleCopy(): void {
    navigator.clipboard?.writeText(this.url).then(() => {
      this.copySuccess = true
      setTimeout(() => { this.copySuccess = false }, 2000)
    }).catch(() => {})
  }

  private close(): void {
    this.dispatchEvent(new CustomEvent('close', { bubbles: true, composed: true }))
  }

  render(): unknown {
    return html`
      <div class="dialog" @click=${(e: Event) => e.stopPropagation()}>
        <h3>Pair Mobile</h3>

        <div class="qr-container" style=${this.qrDataUrl ? '' : 'display:none'}>
          ${this.qrDataUrl
            ? html`<canvas id="qr-canvas"></canvas><img src=${this.qrDataUrl} alt="QR Code" style="display:none" @load=${(e: Event) => {
                // qrcode generates an img, but we use canvas; the img load triggers render
                const img = e.target as HTMLImageElement
                const canvas = this.renderRoot.querySelector('#qr-canvas') as HTMLCanvasElement
                if (canvas) {
                  canvas.width = img.naturalWidth
                  canvas.height = img.naturalHeight
                  const ctx = canvas.getContext('2d')
                  ctx?.drawImage(img, 0, 0)
                }
              }} />`
            : html`<div style="width:200px;height:200px;display:flex;align-items:center;justify-content:center;color:#888;font-size:12px">Generating...</div>`}
        </div>

        <div style="font-size:11px;color:#666;text-align:center">
          Scan with your phone camera, or copy the URL below.
        </div>

        <div class="pair-url">${this.url}</div>

        <div class="actions">
          <button class="btn-close" @click=${this.close}>Close</button>
          <button class="btn-copy" @click=${this.handleCopy}>
            ${this.copySuccess ? 'Copied!' : 'Copy URL'}
          </button>
        </div>
      </div>
    `
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'vc-pairing-dialog': VcPairingDialog
  }
}
