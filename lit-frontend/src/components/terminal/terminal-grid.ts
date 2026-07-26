import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import './text-terminal.js'

/**
 * Tree-based layout for the terminal grid.
 *   leaf:    a single terminal pane
 *   split:   divider with direction (h=horizontal split = children side by side,
 *            v=vertical split = children stacked top/bottom) and a ratio (0..1)
 */
export type GridNode =
  | { type: 'leaf'; id: string; terminalId: string; title: string }
  | { type: 'split'; dir: 'h' | 'v'; ratio: number; a: GridNode; b: GridNode }

const RESIZER_PX = 4

@customElement('vc-terminal-grid')
export class VcTerminalGrid extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex: 1;
      min-height: 0;
      min-width: 0;
      background: #0d0d0d;
    }
    .leaf {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 0;
      min-height: 0;
      background: #1a1a1a;
      position: relative;
    }
    .leaf.focused { box-shadow: inset 0 0 0 1px var(--accent, #818cf8); }
    .leaf-header {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 2px 8px;
      background: #1a1a1a;
      border-bottom: 1px solid #2a2a2a;
      font-size: 10px;
      font-family: monospace;
      color: #888;
      flex-shrink: 0;
      height: 22px;
    }
    .leaf-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .leaf-actions { display: flex; gap: 2px; }
    .leaf-actions button {
      background: none;
      border: none;
      color: #888;
      cursor: pointer;
      padding: 2px 6px;
      font-size: 11px;
      border-radius: 2px;
    }
    .leaf-actions button:hover { color: #fff; background: #2a2a2a; }
    .leaf-actions .close:hover { color: #ef4444; }
    .leaf-body { flex: 1; min-height: 0; display: flex; }
    .leaf-body vc-text-terminal { flex: 1; min-height: 0; }
    .leaf-empty {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      color: #555;
      font-size: 14px;
    }
    .split-h { display: flex; flex-direction: row; flex: 1; min-height: 0; min-width: 0; }
    .split-v { display: flex; flex-direction: column; flex: 1; min-height: 0; min-width: 0; }
    .resizer-h {
      width: ${RESIZER_PX}px;
      cursor: col-resize;
      background: #2a2a2a;
      flex-shrink: 0;
      transition: background .15s;
    }
    .resizer-h:hover, .resizer-h.dragging { background: var(--accent, #818cf8); }
    .resizer-v {
      height: ${RESIZER_PX}px;
      cursor: row-resize;
      background: #2a2a2a;
      flex-shrink: 0;
      transition: background .15s;
    }
    .resizer-v:hover, .resizer-v.dragging { background: var(--accent, #818cf8); }
    .empty-grid {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      color: #555;
    }
    .empty-grid button {
      padding: 8px 16px;
      background: var(--accent, #818cf8);
      color: #fff;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 13px;
    }
    .empty-grid button:hover { opacity: .9; }
    .toolbar {
      display: flex;
      gap: 4px;
      padding: 4px 8px;
      background: #1a1a1a;
      border-top: 1px solid #2a2a2a;
      flex-shrink: 0;
    }
    .toolbar button {
      background: none;
      border: 1px solid var(--border, #2a2a2a);
      color: var(--text-primary, #e5e5e5);
      padding: 4px 10px;
      border-radius: 3px;
      cursor: pointer;
      font-size: 11px;
      font-family: monospace;
    }
    .toolbar button:hover { border-color: var(--accent, #818cf8); }
    .toolbar button:disabled { opacity: .4; cursor: not-allowed; }
  `

  @state() private root: GridNode | null = null
  @state() private focusedId: string | null = null
  private nextId = 1

  private generateId(): string {
    return `term-${this.nextId++}`
  }

  hasTerminals(): boolean {
    return this.root !== null
  }

  focusedTerminalId(): string | null {
    if (!this.focusedId || !this.root) return null
    return this.findTerminalId(this.root, this.focusedId)
  }

  private findTerminalId(node: GridNode, leafId: string): string | null {
    if (node.type === 'leaf') return node.id === leafId ? node.terminalId : null
    return this.findTerminalId(node.a, leafId) ?? this.findTerminalId(node.b, leafId)
  }

  addTerminal(terminalId: string, title: string): void {
    const newLeaf: GridNode = { type: 'leaf', id: this.generateId(), terminalId, title }
    if (!this.root) {
      this.root = newLeaf
      this.focusedId = newLeaf.id
    } else {
      // Split the focused leaf (or root) horizontally by default
      const target = this.focusedId ? this.findLeaf(this.root, this.focusedId) ?? this.root : this.root
      this.root = this.replaceLeaf(this.root, target.id, { type: 'split', dir: 'h', ratio: 0.5, a: target, b: newLeaf })
      this.focusedId = newLeaf.id
    }
    this.requestUpdate()
  }

  splitFocused(dir: 'h' | 'v'): void {
    if (!this.root) return
    const target = this.focusedId ? this.findLeaf(this.root, this.focusedId) ?? this.root : this.root
    const newLeaf: GridNode = { type: 'leaf', id: this.generateId(), terminalId: `${this.nextId}-pending`, title: 'new' }
    this.root = this.replaceLeaf(this.root, target.id, { type: 'split', dir, ratio: 0.5, a: target, b: newLeaf })
    this.focusedId = newLeaf.id
    this.requestUpdate()
    this.dispatchEvent(new CustomEvent('split-focused', { detail: { leafId: newLeaf.id }, bubbles: true, composed: true }))
  }

  closeLeaf(leafId: string): void {
    if (!this.root) return
    const result = this.removeLeaf(this.root, leafId)
    this.root = result.node
    if (result.removedTerminalId) {
      this.dispatchEvent(new CustomEvent('terminal-closed', { detail: { terminalId: result.removedTerminalId }, bubbles: true, composed: true }))
    }
    if (this.root && this.root.type === 'leaf' && this.focusedId === leafId) {
      this.focusedId = this.root.id
    }
    this.requestUpdate()
  }

  private findLeaf(node: GridNode, leafId: string): GridNode | null {
    if (node.type === 'leaf') return node.id === leafId ? node : null
    return this.findLeaf(node.a, leafId) ?? this.findLeaf(node.b, leafId)
  }

  private replaceLeaf(node: GridNode, leafId: string, replacement: GridNode): GridNode {
    if (node.type === 'leaf' && node.id === leafId) return replacement
    if (node.type === 'split') {
      return { ...node, a: this.replaceLeaf(node.a, leafId, replacement), b: this.replaceLeaf(node.b, leafId, replacement) }
    }
    return node
  }

  private removeLeaf(node: GridNode, leafId: string): { node: GridNode | null; removedTerminalId: string | null } {
    if (node.type === 'leaf') {
      if (node.id === leafId) return { node: null, removedTerminalId: node.terminalId }
      return { node, removedTerminalId: null }
    }
    if (node.a.type === 'leaf' && node.a.id === leafId) {
      return { node: node.b, removedTerminalId: node.a.terminalId }
    }
    if (node.b.type === 'leaf' && node.b.id === leafId) {
      return { node: node.a, removedTerminalId: node.b.terminalId }
    }
    const a = this.removeLeaf(node.a, leafId)
    if (a.removedTerminalId) return { node: { ...node, a: a.node ?? node.a }, removedTerminalId: a.removedTerminalId }
    const b = this.removeLeaf(node.b, leafId)
    if (b.removedTerminalId) return { node: { ...node, b: b.node ?? node.b }, removedTerminalId: b.removedTerminalId }
    return { node, removedTerminalId: null }
  }

  private setRatio(node: GridNode, leafId: string, ratio: number): GridNode {
    if (node.type === 'leaf') return node
    if (node.a.type === 'leaf' && node.a.id === leafId) return { ...node, ratio }
    if (node.b.type === 'leaf' && node.b.id === leafId) return { ...node, ratio: 1 - ratio }
    return { ...node, a: this.setRatio(node.a, leafId, ratio), b: this.setRatio(node.b, leafId, ratio) }
  }

  private startDrag(e: PointerEvent, node: GridNode, leafId: string): void {
    const target = e.currentTarget as HTMLElement
    target.classList.add('dragging')
    target.setPointerCapture(e.pointerId)
    const rect = target.parentElement!.getBoundingClientRect()
    const initialRatio = node.ratio
    const move = (ev: PointerEvent) => {
      const newRatio = node.dir === 'h'
        ? Math.max(0.1, Math.min(0.9, (ev.clientX - rect.left) / rect.width))
        : Math.max(0.1, Math.min(0.9, (ev.clientY - rect.top) / rect.height))
      if (this.root) {
        this.root = this.setRatio(this.root, leafId, newRatio)
        this.requestUpdate()
      }
    }
    const up = () => {
      target.classList.remove('dragging')
      target.releasePointerCapture(e.pointerId)
      target.removeEventListener('pointermove', move)
      target.removeEventListener('pointerup', up)
    }
    target.addEventListener('pointermove', move)
    target.addEventListener('pointerup', up)
  }

  private renderNode(node: GridNode): unknown {
    if (node.type === 'leaf') {
      return html`
        <div class="leaf ${classMap({ focused: this.focusedId === node.id })}"
             @click=${(e: Event) => { this.focusedId = node.id; e.stopPropagation() }}>
          <div class="leaf-header">
            <span class="leaf-title">${node.title}</span>
            <div class="leaf-actions">
              <button @click=${(e: Event) => { e.stopPropagation(); this.splitFocused('h') }} title="Split horizontal">⇆</button>
              <button @click=${(e: Event) => { e.stopPropagation(); this.splitFocused('v') }} title="Split vertical">⇅</button>
              <button class="close" @click=${(e: Event) => { e.stopPropagation(); this.closeLeaf(node.id) }} title="Close">✕</button>
            </div>
          </div>
          <div class="leaf-body">
            ${node.terminalId.endsWith('-pending')
              ? html`<div class="leaf-empty">Setting up terminal...</div>`
              : html`<vc-text-terminal sessionId=${node.terminalId}></vc-text-terminal>`}
          </div>
        </div>
      `
    }
    const dirClass = node.dir === 'h' ? 'split-h' : 'split-v'
    const resizerClass = node.dir === 'h' ? 'resizer-h' : 'resizer-v'
    const aId = node.a.type === 'leaf' ? node.a.id : null
    const styleA = node.dir === 'h' ? `flex: ${node.ratio};` : `flex: ${node.ratio};`
    const styleB = node.dir === 'h' ? `flex: ${1 - node.ratio};` : `flex: ${1 - node.ratio};`
    return html`
      <div class="${dirClass}">
        <div style="${styleA}min-width:0;min-height:0;display:flex">${this.renderNode(node.a)}</div>
        <div class="${resizerClass}" @pointerdown=${(e: PointerEvent) => aId && this.startDrag(e, node, aId)}></div>
        <div style="${styleB}min-width:0;min-height:0;display:flex">${this.renderNode(node.b)}</div>
      </div>
    `
  }

  render(): unknown {
    return html`
      <div style="display:flex;flex-direction:column;flex:1;min-height:0;min-width:0">
        ${this.root ? this.renderNode(this.root) : html`
          <div class="empty-grid">
            <div>No terminals</div>
            <button @click=${() => this.dispatchEvent(new CustomEvent('add-terminal', { bubbles: true, composed: true }))}>+ New Terminal</button>
          </div>
        `}
        <div class="toolbar">
          <button @click=${() => this.splitFocused('h')} ?disabled=${!this.root} title="Split horizontal">⇆ Split H</button>
          <button @click=${() => this.splitFocused('v')} ?disabled=${!this.root} title="Split vertical">⇅ Split V</button>
          <button @click=${() => this.dispatchEvent(new CustomEvent('add-terminal', { bubbles: true, composed: true }))}>+ New Terminal</button>
        </div>
      </div>
    `
  }
}

// classMap inline (avoid extra import)
function classMap<T extends Record<string, boolean | string | number>>(classes: T): string {
  return Object.entries(classes).filter(([, v]) => !!v).map(([k]) => k).join(' ')
}
