import { LitElement, html, css, type TemplateResult } from 'lit'
import { customElement, property } from 'lit/decorators.js'

@customElement('vc-markdown')
export class VcMarkdown extends LitElement {
  static styles = css`
    :host {
      display: block;
      line-height: 1.55;
      color: var(--text-primary, #e0e0e0);
      word-wrap: break-word;
      overflow-wrap: break-word;
      font-size: 14px;
    }
    :host > *:first-child { margin-top: 0; }
    :host > *:last-child { margin-bottom: 0; }
    p { margin: 8px 0; }
    h1, h2, h3, h4, h5, h6 {
      margin: 14px 0 8px; font-weight: 600; line-height: 1.3;
    }
    h1 { font-size: 1.5em; border-bottom: 1px solid var(--border, #3a3a3a); padding-bottom: 4px; }
    h2 { font-size: 1.3em; }
    h3 { font-size: 1.15em; }
    h4 { font-size: 1.05em; }
    h5 { font-size: 1em; }
    h6 { font-size: 0.9em; color: var(--text-secondary, #888); }
    pre {
      background: var(--bg-code, #1e1e1e);
      border: 1px solid var(--border, #333);
      border-radius: 6px; padding: 10px 12px;
      overflow-x: auto; font-size: 12px; margin: 8px 0;
      font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
    }
    pre code { background: none; padding: 0; font-size: inherit; color: inherit; }
    code {
      background: var(--bg-code, #1e1e1e);
      padding: 1px 5px; border-radius: 3px;
      font-family: 'JetBrains Mono', 'Fira Code', Menlo, monospace;
      font-size: 0.9em; color: var(--accent, #818cf8);
    }
    blockquote {
      border-left: 3px solid var(--accent, #818cf8);
      margin: 8px 0; padding: 4px 12px;
      color: var(--text-secondary, #aaa);
      background: rgba(129,140,248,0.05); border-radius: 0 4px 4px 0;
    }
    ul, ol { margin: 6px 0; padding-left: 24px; }
    li { margin: 2px 0; }
    hr { border: 0; border-top: 1px solid var(--border, #333); margin: 12px 0; }
    a { color: var(--accent, #818cf8); text-decoration: none; }
    a:hover { text-decoration: underline; }
    table { border-collapse: collapse; margin: 8px 0; font-size: 0.9em; }
    th, td { border: 1px solid var(--border, #333); padding: 4px 8px; text-align: left; }
    th { background: var(--bg-secondary, #252525); font-weight: 600; }
  `

  @property() content = ''

  render(): TemplateResult {
    return html`${this.parse(this.content)}`
  }

  /** Parse markdown to an array of block-level Templates */
  private parse(text: string): TemplateResult[] {
    const lines = text.split('\n')
    const blocks: TemplateResult[] = []
    let i = 0
    while (i < lines.length) {
      const line = lines[i]
      // Code fence
      if (line.startsWith('```')) {
        const lang = line.slice(3).trim()
        const code: string[] = []
        i++
        while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++ }
        i++
        blocks.push(html`<pre><code class="language-${lang || 'text'}">${code.join('\n')}</code></pre>`)
        continue
      }
      // Heading
      const hm = /^(#{1,6})\s+(.+)$/.exec(line)
      if (hm) {
        const inner = this.parseInline(hm[2])
        const lvl = hm[1].length
        if (lvl === 1) blocks.push(html`<h1>${inner}</h1>`)
        else if (lvl === 2) blocks.push(html`<h2>${inner}</h2>`)
        else if (lvl === 3) blocks.push(html`<h3>${inner}</h3>`)
        else if (lvl === 4) blocks.push(html`<h4>${inner}</h4>`)
        else if (lvl === 5) blocks.push(html`<h5>${inner}</h5>`)
        else blocks.push(html`<h6>${inner}</h6>`)
        i++
        continue
      }
      // HR
      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        blocks.push(html`<hr />`)
        i++
        continue
      }
      // Blockquote
      if (line.startsWith('> ')) {
        const buf: string[] = []
        while (i < lines.length && lines[i].startsWith('> ')) {
          buf.push(lines[i].slice(2))
          i++
        }
        // Render recursively — re-parse quote content as inline
        blocks.push(html`<blockquote>${this.parse(buf.join('\n'))}</blockquote>`)
        continue
      }
      // Unordered list
      if (/^[-*+]\s+/.test(line)) {
        const items: TemplateResult[] = []
        while (i < lines.length && /^[-*+]\s+/.test(lines[i])) {
          items.push(html`<li>${this.parseInline(lines[i].replace(/^[-*+]\s+/, ''))}</li>`)
          i++
        }
        blocks.push(html`<ul>${items}</ul>`)
        continue
      }
      // Ordered list
      if (/^\d+\.\s+/.test(line)) {
        const items: TemplateResult[] = []
        while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
          items.push(html`<li>${this.parseInline(lines[i].replace(/^\d+\.\s+/, ''))}</li>`)
          i++
        }
        blocks.push(html`<ol>${items}</ol>`)
        continue
      }
      // Table
      if (i + 1 < lines.length && /^\|.*\|$/.test(line) && /^\|[\s\-:|]+\|$/.test(lines[i + 1])) {
        const headers = this.tRow(line)
        const aligns = this.tAlign(lines[i + 1])
        i += 2
        const rows: string[][] = []
        while (i < lines.length && /^\|.*\|$/.test(lines[i])) {
          rows.push(this.tRow(lines[i]))
          i++
        }
        blocks.push(html`<table><thead><tr>${
          headers.map((h, j) => html`<th style="text-align:${aligns[j] || 'left'}">${this.parseInline(h)}</th>`)
        }</tr></thead><tbody>${
          rows.map(r => html`<tr>${r.map((c, j) => html`<td style="text-align:${aligns[j] || 'left'}">${this.parseInline(c)}</td>`)}</tr>`)
        }</tbody></table>`)
        continue
      }
      // Empty line
      if (line.trim() === '') { i++; continue }
      // Paragraph
      const buf: string[] = [line]
      i++
      while (i < lines.length && lines[i].trim() !== '' &&
             !lines[i].startsWith('#') && !lines[i].startsWith('```') &&
             !lines[i].startsWith('> ') && !/^[-*+]\s+/.test(lines[i]) && !/^\d+\.\s+/.test(lines[i]) &&
             !/^\|.*\|$/.test(lines[i])) {
        buf.push(lines[i])
        i++
      }
      blocks.push(html`<p>${this.parseInline(buf.join('\n'))}</p>`)
    }
    return blocks
  }

  /** Parse inline markdown to an array of Templates */
  private parseInline(text: string): TemplateResult[] {
    const out: TemplateResult[] = []
    let i = 0
    let buf = ''
    const flush = () => { if (buf) { out.push(html`${buf}`); buf = '' } }
    while (i < text.length) {
      const ch = text[i]
      // Inline code
      if (ch === '`') {
        const end = text.indexOf('`', i + 1)
        if (end !== -1) {
          flush()
          out.push(html`<code>${text.slice(i + 1, end)}</code>`)
          i = end + 1
          continue
        }
      }
      // Bold
      if (ch === '*' && text[i + 1] === '*') {
        const end = text.indexOf('**', i + 2)
        if (end !== -1) {
          flush()
          out.push(html`<strong>${this.parseInline(text.slice(i + 2, end))}</strong>`)
          i = end + 2
          continue
        }
      }
      // Strikethrough
      if (ch === '~' && text[i + 1] === '~') {
        const end = text.indexOf('~~', i + 2)
        if (end !== -1) {
          flush()
          out.push(html`<del>${this.parseInline(text.slice(i + 2, end))}</del>`)
          i = end + 2
          continue
        }
      }
      // Italic
      if ((ch === '*' || ch === '_') && text[i + 1] !== ch && (i === 0 || text[i - 1] !== ch)) {
        const end = text.indexOf(ch, i + 1)
        if (end !== -1 && text[end + 1] !== ch) {
          flush()
          out.push(html`<em>${this.parseInline(text.slice(i + 1, end))}</em>`)
          i = end + 1
          continue
        }
      }
      // Link
      if (ch === '[') {
        const cb = text.indexOf(']', i + 1)
        if (cb !== -1 && text[cb + 1] === '(') {
          const cp = text.indexOf(')', cb + 2)
          if (cp !== -1) {
            const url = text.slice(cb + 2, cp)
            if (!/^javascript:/i.test(url) && !/^data:/i.test(url)) {
              flush()
              const lt = text.slice(i + 1, cb)
              out.push(html`<a href=${url} target="_blank" rel="noopener">${this.parseInline(lt)}</a>`)
              i = cp + 1
              continue
            }
          }
        }
      }
      // Escape HTML
      if (ch === '<') { flush(); out.push(html`&lt;`); i++; continue }
      if (ch === '>') { flush(); out.push(html`&gt;`); i++; continue }
      if (ch === '&') { flush(); out.push(html`&amp;`); i++; continue }
      buf += ch
      i++
    }
    flush()
    return out
  }

  private tRow(line: string): string[] {
    const t = line.replace(/^\|/, '').replace(/\|$/, '')
    return t.split('|').map(c => c.trim())
  }

  private tAlign(line: string): string[] {
    const t = line.replace(/^\|/, '').replace(/\|$/, '')
    return t.split('|').map(c => {
      const x = c.trim()
      if (x.startsWith(':') && x.endsWith(':')) return 'center'
      if (x.endsWith(':')) return 'right'
      if (x.startsWith(':')) return 'left'
      return ''
    })
  }
}
