import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'

interface FsEntry {
  name: string
  type: 'dir' | 'file'
  path: string
  parent: string
}

interface GitStatus {
  branch: string | null
  upstream: string | null
  ahead: number
  behind: number
  files: Array<{ raw: string; staged: string; working: string; path: string }>
  notice?: string
}

interface GitLogEntry {
  hash: string
  shortHash: string
  author: string
  message: string
  date: string
}

const FOLDER_SVG = html`
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1z"/>
  </svg>
`

const FOLDER_OPEN_SVG = html`
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M.513 1.513A1.75 1.75 0 0 1 1.75 1h3.5c.55 0 1.07.26 1.4.7l.9 1.2a.25.25 0 0 0 .2.1H13a1 1 0 0 1 1 1v.5H2.75a1.75 1.75 0 0 0-1.732 1.5H1V2.75a1.75 1.75 0 0 1 .513-1.237M14.5 6H2.75a.25.25 0 0 0-.25.43l2.108 2.756L4.92 10.5l-2.287-2.5a.25.25 0 0 0-.182-.085H.75A.75.75 0 0 1 .75 7h13.75a.75.75 0 0 1 0 1.5"/>
  </svg>
`

const FILE_SVG = html`
  <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
    <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688L10.5 1.312Z"/>
  </svg>
`

@customElement('vc-explorer')
export class VcExplorer extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary, #1a1a1a);
      border-right: 1px solid var(--border, #2a2a2a);
      font-size: 12px;
      overflow: hidden;
    }

    /* Header */
    .header {
      display: flex;
      flex-direction: column;
      border-bottom: 1px solid var(--border, #2a2a2a);
      flex-shrink: 0;
    }
    .header-top {
      padding: 8px 12px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .header-top .cwd {
      flex: 1;
      color: var(--text-primary, #e5e5e5);
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 11px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .header-top .cwd.empty { color: var(--text-secondary, #888); font-style: italic; }
    .icon-btn {
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      cursor: pointer;
      padding: 4px;
      border-radius: 3px;
      display: flex;
      align-items: center;
    }
    .icon-btn:hover { color: var(--text-primary, #e5e5e5); background: var(--bg-tertiary, #222); }
    .icon-btn.active { color: var(--accent, #818cf8); background: var(--accent-light, #1e1b4b); }

    /* Sub-tabs: Files | Git */
    .tabs {
      display: flex;
      padding: 0 8px;
      gap: 2px;
    }
    .tab-btn {
      flex: 1;
      padding: 6px 8px;
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      font-size: 11px;
      font-weight: 500;
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: color .15s, border-color .15s;
    }
    .tab-btn:hover { color: var(--text-primary, #e5e5e5); }
    .tab-btn.active { color: var(--accent, #818cf8); border-bottom-color: var(--accent, #818cf8); }
    .tab-btn .badge {
      display: inline-block;
      margin-left: 4px;
      padding: 1px 5px;
      background: var(--bg-tertiary, #222);
      border-radius: 8px;
      font-size: 10px;
      color: var(--text-secondary, #888);
    }
    .tab-btn.active .badge { background: var(--accent, #818cf8); color: #fff; }

    /* File tree */
    .tree {
      flex: 1;
      overflow-y: auto;
      padding: 4px 0;
    }
    .empty-state {
      padding: 32px 16px;
      text-align: center;
      color: var(--text-secondary, #666);
      font-size: 11px;
      line-height: 1.6;
    }
    .tree-item {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px 3px 0;
      cursor: pointer;
      white-space: nowrap;
      color: var(--text-primary, #e5e5e5);
      user-select: none;
      height: 22px;
    }
    .tree-item:hover { background: var(--bg-tertiary, #222); }
    .tree-item .indent { display: inline-block; flex-shrink: 0; }
    .tree-item .arrow {
      display: inline-flex;
      width: 14px;
      align-items: center;
      justify-content: center;
      transition: transform .15s;
      font-size: 9px;
      color: var(--text-secondary, #888);
      flex-shrink: 0;
    }
    .tree-item .arrow.open { transform: rotate(90deg); }
    .tree-item .arrow.loading { animation: spin 1s linear infinite; }
    .tree-item .icon { display: inline-flex; align-items: center; color: var(--warning, #f59e0b); flex-shrink: 0; }
    .tree-item.file .icon { color: var(--text-secondary, #888); }
    .tree-item .name {
      overflow: hidden;
      text-overflow: ellipsis;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 12px;
    }
    .tree-item .status-dot {
      margin-left: auto;
      font-size: 10px;
      font-weight: 700;
      width: 14px;
      text-align: center;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Git panel */
    .git-panel { flex: 1; overflow-y: auto; }
    .git-info {
      padding: 8px 12px;
      border-bottom: 1px solid var(--border, #2a2a2a);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .git-branch-row {
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .git-branch-icon {
      color: var(--accent, #818cf8);
      display: inline-flex;
    }
    .git-branch-name { color: var(--accent, #818cf8); font-weight: 600; font-size: 12px; }
    .git-upstream { color: var(--text-secondary, #888); font-size: 11px; }
    .git-ahead { color: var(--success, #22c55e); font-size: 11px; }
    .git-behind { color: var(--warning, #f59e0b); font-size: 11px; }
    .git-notice {
      color: var(--text-secondary, #888);
      padding: 12px;
      font-style: italic;
      text-align: center;
    }
    .git-actions-bar {
      display: flex;
      gap: 6px;
      padding: 8px 12px;
      flex-wrap: wrap;
      border-bottom: 1px solid var(--border, #2a2a2a);
    }
    .git-btn {
      font-size: 10px;
      padding: 4px 8px;
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 3px;
      background: transparent;
      color: var(--text-primary, #e5e5e5);
      cursor: pointer;
      font-family: inherit;
    }
    .git-btn:hover { border-color: var(--accent, #818cf8); }
    .git-btn.primary {
      background: var(--accent, #818cf8);
      color: #fff;
      border-color: var(--accent, #818cf8);
    }
    .git-btn:disabled { opacity: .5; cursor: not-allowed; }

    .commit-box {
      display: flex;
      gap: 4px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--border, #2a2a2a);
    }
    .commit-box input {
      flex: 1;
      min-width: 0;
      background: var(--bg-tertiary, #222);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 3px;
      color: var(--text-primary, #e5e5e5);
      padding: 5px 8px;
      font-size: 11px;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .commit-box input:focus { outline: none; border-color: var(--accent, #818cf8); }

    /* Git file rows (clickable to expand inline diff) */
    .git-file-list { padding: 4px 0; }
    .git-file {
      display: flex;
      flex-direction: column;
      cursor: pointer;
    }
    .git-file-row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 11px;
    }
    .git-file-row:hover { background: var(--bg-tertiary, #222); }
    .st {
      display: inline-block;
      width: 14px;
      text-align: center;
      font-weight: 700;
      font-size: 10px;
    }
    .st.staged-M { color: var(--warning, #f59e0b); }
    .st.staged-A { color: var(--success, #22c55e); }
    .st.staged-D { color: var(--error, #ef4444); }
    .st.staged-R { color: var(--accent, #818cf8); }
    .st.staged-C { color: var(--accent, #818cf8); }
    .st.untracked { color: var(--text-secondary, #666); font-weight: 400; }
    .st.empty { color: transparent; }
    .git-file .filename { flex: 1; overflow: hidden; text-overflow: ellipsis; }
    .git-file .file-actions {
      opacity: 0;
      display: flex;
      gap: 2px;
      transition: opacity .15s;
    }
    .git-file:hover .file-actions { opacity: 1; }
    .file-action-btn {
      background: none;
      border: none;
      color: var(--text-secondary, #888);
      cursor: pointer;
      padding: 2px 4px;
      font-size: 10px;
      border-radius: 2px;
    }
    .file-action-btn:hover { color: var(--accent, #818cf8); background: var(--bg-primary, #1a1a1a); }

    /* Inline diff */
    .inline-diff {
      background: #0d0d0d;
      border-top: 1px solid var(--border, #2a2a2a);
      border-bottom: 1px solid var(--border, #2a2a2a);
      max-height: 400px;
      overflow-y: auto;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 11px;
      line-height: 1.5;
    }
    .inline-diff .diff-loading { padding: 12px; text-align: center; color: var(--text-secondary, #666); }
    .inline-diff .diff-empty { padding: 12px; text-align: center; color: var(--text-secondary, #666); }
    .diff-line {
      display: grid;
      grid-template-columns: 50px 50px 1fr;
      white-space: pre;
    }
    .diff-line .ln { color: var(--text-secondary, #555); text-align: right; padding: 0 6px; user-select: none; }
    .diff-line.add { background: #0a2e0a; }
    .diff-line.add .ln { color: #4ade80; }
    .diff-line.add .marker { color: #22c55e; }
    .diff-line.del { background: #2e0a0a; }
    .diff-line.del .ln { color: #f87171; }
    .diff-line.del .marker { color: #ef4444; }
    .diff-line.hunk { background: var(--accent-light, #1e1b4b); color: var(--accent, #818cf8); font-weight: 600; }
    .diff-line.hunk .ln { color: var(--accent, #818cf8); }
    .diff-line .marker { color: var(--text-secondary, #555); text-align: center; user-select: none; }
    .diff-line .content { padding: 0 8px; overflow-x: auto; }

    /* Log list */
    .log-list {
      border-top: 1px solid var(--border, #2a2a2a);
      max-height: 200px;
      overflow-y: auto;
    }
    .log-entry {
      padding: 4px 12px;
      font-family: 'Menlo', 'Monaco', monospace;
      font-size: 10px;
      display: flex;
      gap: 8px;
    }
    .log-entry:hover { background: var(--bg-tertiary, #222); }
    .log-hash { color: var(--accent, #818cf8); }
    .log-msg { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  `

  @property() cwd = ''
  @state() private children = new Map<string, FsEntry[]>()
  @state() private expanded = new Set<string>()
  @state() private loading = new Set<string>()
  @state() private gitStatus: GitStatus | null = null
  @state() private activeTab: 'files' | 'git' = 'git'
  @state() private expandedDiffs = new Set<string>()
  @state() private diffCache = new Map<string, string>()
  @state() private loadingDiffs = new Set<string>()
  @state() private commitMsg = ''
  @state() private logCommits: GitLogEntry[] = []
  @state() private showLog = false

  updated(changed: Map<string, unknown>): void {
    if (changed.has('cwd') && this.cwd) {
      // Defer refresh to avoid requestUpdate() inside updated() lifecycle
      Promise.resolve().then(() => this.refresh())
    }
  }

  async refresh(): Promise<void> {
    if (!this.cwd) return
    await Promise.all([this.loadRoot(), this.loadGitStatus()])
  }

  private async loadRoot(): Promise<void> {
    if (!this.cwd) return
    await this.loadChildren(this.cwd)
  }

  private async loadChildren(parentPath: string): Promise<void> {
    if (this.children.has(parentPath)) return
    this.loading.add(parentPath)
    this.requestUpdate()
    try {
      const url = `/api/v1/fs/list?path=${encodeURIComponent(parentPath)}&showFiles=true`
      const res = await fetch(url)
      if (!res.ok) {
        this.loading.delete(parentPath)
        this.requestUpdate()
        return
      }
      const data = await res.json() as { entries: Array<{ name: string; type: 'directory' | 'file' }> }
      const entries: FsEntry[] = (data.entries ?? [])
        .filter(e => !e.name.startsWith('.'))
        .map(e => ({
          name: e.name,
          type: e.type === 'directory' ? 'dir' : 'file',
          path: parentPath === '/' ? `/${e.name}` : `${parentPath}/${e.name}`,
          parent: parentPath,
        }))
      this.children.set(parentPath, entries)
      this.loading.delete(parentPath)
      this.requestUpdate()
    } catch {
      this.loading.delete(parentPath)
      this.requestUpdate()
    }
  }

  async loadGitStatus(): Promise<void> {
    if (!this.cwd) return
    try {
      const res = await fetch(`/api/v1/git/status?cwd=${encodeURIComponent(this.cwd)}`)
      if (!res.ok) return
      this.gitStatus = await res.json() as GitStatus
      this.requestUpdate()
    } catch { /* ignore */ }
  }

  private async toggleDir(entry: FsEntry): Promise<void> {
    if (this.expanded.has(entry.path)) {
      this.expanded.delete(entry.path)
      this.requestUpdate()
    } else {
      this.expanded.add(entry.path)
      this.requestUpdate()
      await this.loadChildren(entry.path)
    }
  }

  private statusOf(path: string): { staged: string; working: string } | null {
    if (!this.gitStatus) return null
    // Match by basename and partial path
    const f = this.gitStatus.files.find(x => x.path === path || x.path.endsWith('/' + path))
    if (!f) return null
    return { staged: f.staged, working: f.working }
  }

  private renderTree(parentPath: string, depth: number): unknown {
    const entries = this.children.get(parentPath) ?? []
    if (entries.length === 0 && !this.loading.has(parentPath)) {
      if (depth === 0) return html`<div class="empty-state">No files</div>`
      return ''
    }
    const sorted = [...entries].sort((a, b) => {
      if (a.type !== b.type) return a.type === 'dir' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return sorted.map(e => {
      const isDir = e.type === 'dir'
      const isExpanded = this.expanded.has(e.path)
      const isLoading = this.loading.has(e.path)
      const stat = isDir ? null : this.statusOf(e.path)
      return html`
        <div class="tree-item ${classMap({ dir: isDir, file: !isDir })}">
          <span class="indent" style="width:${depth * 14}px"></span>
          ${isDir
            ? html`<span class="arrow ${classMap({ open: isExpanded, loading: isLoading })}" @click=${() => this.toggleDir(e)}>${isLoading ? '◌' : '▶'}</span>`
            : html`<span class="arrow"></span>`}
          ${isDir
            ? (isExpanded ? FOLDER_OPEN_SVG : FOLDER_SVG)
            : FILE_SVG}
          <span class="name" @click=${isDir ? () => this.toggleDir(e) : undefined}>${e.name}</span>
          ${stat ? html`<span class="status-dot st staged-${stat.staged === ' ' ? 'empty' : stat.staged}">${stat.staged === ' ' ? (stat.working === '?' ? '?' : '') : stat.staged}</span>` : ''}
        </div>
        ${isDir && isExpanded ? html`<div>${this.renderTree(e.path, depth + 1)}</div>` : ''}
      `
    })
  }

  private async loadDiff(filePath: string): Promise<void> {
    if (this.expandedDiffs.has(filePath)) {
      this.expandedDiffs.delete(filePath)
      this.requestUpdate()
      return
    }
    this.expandedDiffs.add(filePath)
    this.requestUpdate()
    if (this.diffCache.has(filePath)) return
    this.loadingDiffs.add(filePath)
    this.requestUpdate()
    try {
      const res = await fetch(`/api/v1/git/diff?cwd=${encodeURIComponent(this.cwd)}&file=${encodeURIComponent(filePath)}`)
      if (!res.ok) return
      const data = await res.json() as { diff: string }
      this.diffCache.set(filePath, data.diff)
      this.loadingDiffs.delete(filePath)
      this.requestUpdate()
    } catch {
      this.loadingDiffs.delete(filePath)
      this.requestUpdate()
    }
  }

  private renderInlineDiff(filePath: string): unknown {
    if (this.loadingDiffs.has(filePath)) {
      return html`<div class="inline-diff"><div class="diff-loading">Loading diff…</div></div>`
    }
    const diff = this.diffCache.get(filePath) ?? ''
    if (!diff.trim()) {
      return html`<div class="inline-diff"><div class="diff-empty">No changes</div></div>`
    }
    const lines = diff.split('\n')
    let oldLn = 0
    let newLn = 0
    return html`
      <div class="inline-diff">
        ${lines.map((l) => {
          if (l.startsWith('@@')) {
            const m = l.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/)
            if (m) { oldLn = parseInt(m[1]); newLn = parseInt(m[2]) }
            return html`<div class="diff-line hunk"><span class="ln">${oldLn}</span><span class="ln">${newLn}</span><span class="content">${l}</span></div>`
          }
          if (l.startsWith('diff --git') || l.startsWith('index ')) {
            return html`<div class="diff-line"><span class="ln"></span><span class="ln"></span><span class="content" style="color:var(--text-secondary,#555)">${l}</span></div>`
          }
          if (l.startsWith('+++') || l.startsWith('---')) {
            return ''
          }
          if (l.startsWith('+')) {
            const c = html`<div class="diff-line add"><span class="ln"></span><span class="ln">${newLn++}</span><span class="marker">+</span><span class="content">${l.substring(1)}</span></div>`
            return c
          }
          if (l.startsWith('-')) {
            return html`<div class="diff-line del"><span class="ln">${oldLn++}</span><span class="ln"></span><span class="marker">−</span><span class="content">${l.substring(1)}</span></div>`
          }
          return html`<div class="diff-line"><span class="ln">${oldLn++}</span><span class="ln">${newLn++}</span><span class="marker"> </span><span class="content">${l}</span></div>`
        })}
      </div>
    `
  }

  private async gitAction(action: string, file?: string): Promise<void> {
    try {
      const body = file ? { cwd: this.cwd, files: [file] } : { cwd: this.cwd }
      const res = await fetch(`/api/v1/git/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) return
      await this.loadGitStatus()
      // Invalidate diff cache for this file (stage/unstage affects diff)
      if (file) this.diffCache.delete(file)
      else this.diffCache.clear()
      this.requestUpdate()
    } catch { /* ignore */ }
  }

  private async gitCommit(): Promise<void> {
    if (!this.commitMsg.trim()) return
    try {
      const res = await fetch('/api/v1/git/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cwd: this.cwd, message: this.commitMsg }),
      })
      if (!res.ok) return
      this.commitMsg = ''
      this.diffCache.clear()
      await this.loadGitStatus()
      this.requestUpdate()
    } catch { /* ignore */ }
  }

  private async loadLog(): Promise<void> {
    try {
      const res = await fetch(`/api/v1/git/log?cwd=${encodeURIComponent(this.cwd)}&limit=20`)
      if (!res.ok) return
      const data = await res.json() as { commits: GitLogEntry[] }
      this.logCommits = data.commits
      this.showLog = !this.showLog
      this.requestUpdate()
    } catch { /* ignore */ }
  }

  private renderGitPanel(): unknown {
    const gs = this.gitStatus
    if (gs?.notice) {
      return html`<div class="git-notice">${gs.notice}</div>`
    }
    if (!gs || !gs.branch) {
      return html`<div class="git-notice">No git repository</div>`
    }
    const changesCount = gs.files.length
    return html`
      <div class="git-info">
        <div class="git-branch-row">
          <span class="git-branch-icon">⑂</span>
          <span class="git-branch-name">${gs.branch}</span>
          ${gs.upstream ? html`<span class="git-upstream">↔ ${gs.upstream}</span>` : ''}
          ${gs.ahead > 0 ? html`<span class="git-ahead">↑${gs.ahead}</span>` : ''}
          ${gs.behind > 0 ? html`<span class="git-behind">↓${gs.behind}</span>` : ''}
        </div>
      </div>

      <div class="git-file-list">
        ${gs.files.length === 0
          ? html`<div class="git-notice">Working tree clean</div>`
          : gs.files.map(f => this.renderGitFile(f))}
      </div>

      ${this.showLog && this.logCommits.length > 0 ? html`
        <div class="log-list">
          ${this.logCommits.map(c => html`
            <div class="log-entry">
              <span class="log-hash">${c.shortHash}</span>
              <span class="log-msg" title="${c.message}">${c.message}</span>
            </div>
          `)}
        </div>
      ` : ''}
    `
  }

  private renderGitFile(f: { raw: string; staged: string; working: string; path: string }): unknown {
    const isExpanded = this.expandedDiffs.has(f.path)
    const isUntracked = f.raw.endsWith('??')
    const stagedChar = f.staged.trim() || (isUntracked ? '?' : '·')
    const workingChar = f.working.trim() || '·'
    return html`
      <div class="git-file">
        <div class="git-file-row" @click=${() => this.loadDiff(f.path)}>
          <span class="st ${isUntracked ? 'untracked' : 'staged-' + stagedChar}">${stagedChar}</span>
          <span class="st ${workingChar === '?' || workingChar === ' ' ? 'empty' : 'staged-' + workingChar}">${workingChar === ' ' ? '' : workingChar}</span>
          <span class="filename">${f.path}</span>
          <span class="file-actions">
            ${stagedChar !== 'A' && stagedChar !== 'M' ? html`
              <button class="file-action-btn" @click=${(e: Event) => { e.stopPropagation(); this.gitAction('stage', f.path) }} title="Stage">+</button>
            ` : ''}
            ${stagedChar !== ' ' && stagedChar !== '?' && stagedChar !== 'A' ? html`
              <button class="file-action-btn" @click=${(e: Event) => { e.stopPropagation(); this.gitAction('unstage', f.path) }} title="Unstage">−</button>
            ` : ''}
          </span>
        </div>
        ${isExpanded ? this.renderInlineDiff(f.path) : ''}
      </div>
    `
  }

  render(): unknown {
    const gs = this.gitStatus
    const changesCount = gs?.files?.length ?? 0
    return html`
      <div class="header">
        <div class="header-top">
          <span class="cwd ${classMap({ empty: !this.cwd })}" title=${this.cwd || ''}>${this.cwd || 'no session'}</span>
          <button class="icon-btn" @click=${this.refresh} title="Refresh">↻</button>
        </div>
        <div class="tabs">
          <button class="tab-btn ${classMap({ active: this.activeTab === 'files' })}" @click=${() => { this.activeTab = 'files' }}>Files</button>
          <button class="tab-btn ${classMap({ active: this.activeTab === 'git' })}" @click=${() => { this.activeTab = 'git' }}>
            Git${changesCount > 0 ? html`<span class="badge">${changesCount}</span>` : ''}
          </button>
        </div>
      </div>

      ${this.activeTab === 'files'
        ? html`<div class="tree">${this.renderTree(this.cwd, 0)}</div>`
        : html`<div class="git-panel">${this.renderGitPanel()}</div>`}
    `
  }
}
