import { LitElement, html, css } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { when } from 'lit/directives/when.js'
import './header.js'
import './main-view.js'
import './footer.js'
import './tabs-bar.js'
import './dialog-new-tab.js'
import './pairing-dialog.js'
import './chat-panel.js'
import './model-picker.js'
import './explorer/explorer.js'
import './terminal/terminal-grid.js'
import './tasks-list.js'
import './terminal/xterm-terminal.js'
import type { Session, Message, StreamEvent, Command, ModelInfo, Notification } from '../types.js'
import { DaemonClient } from '../api/client.js'
import { tabStore } from '../state/tab-store.js'
import { connectionStore } from '../state/connection-store.js'

@customElement('vc-app-shell')
export class VcAppShell extends LitElement {
  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      height: 100vh;
      background: var(--bg-primary, #1a1a1a);
      color: var(--text-primary, #e5e5e5);
      --bg-primary: #1a1a1a;
      --bg-secondary: #1a1a1a;
      --bg-tertiary: #222;
      --text-primary: #e5e5e5;
      --text-secondary: #888;
      --border: #2a2a2a;
      --accent: #818cf8;
      --accent-light: #1e1b4b;
      --success: #22c55e;
      --warning: #f59e0b;
      --error: #ef4444;
    }
    /* Light theme: applied via .light class on documentElement (manual toggle)
       OR via system preference when no explicit choice is saved */
    :host-context(html.light) {
      --bg-primary: #ffffff;
      --bg-secondary: #f5f5f5;
      --bg-tertiary: #e5e5e5;
      --text-primary: #1a1a1a;
      --text-secondary: #666;
      --border: #ddd;
      --accent: #4f46e5;
      --accent-light: #eef2ff;
    }
    @media (prefers-color-scheme: light) {
      :host-context(html:not(.dark)) {
        --bg-primary: #ffffff;
        --bg-secondary: #f5f5f5;
        --bg-tertiary: #e5e5e5;
        --text-primary: #1a1a1a;
        --text-secondary: #666;
        --border: #ddd;
        --accent: #4f46e5;
        --accent-light: #eef2ff;
      }
    }
    .grid-container {
      flex: 1;
      display: grid;
      min-height: 0;
      overflow: hidden;
    }
    /* Single tab: full width */
    .grid-container.single {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr;
    }
    /* Multi tab: main chat left, secondary right, terminal bottom-span */
    .grid-container.multi {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 1fr auto;
    }
    .grid-container.multi .main-pane { grid-column: 1; grid-row: 1; }
    .grid-container.multi .side-pane { grid-column: 2; grid-row: 1; border-left: 1px solid #2a2a2a; }
    .grid-container.multi .bottom-pane { grid-column: 1 / -1; grid-row: 2; border-top: 1px solid #2a2a2a; min-height: 120px; max-height: 300px; }
    /* Single tab + terminal: chat top, terminal bottom */
    .grid-container.chat-term {
      grid-template-columns: 1fr;
      grid-template-rows: 1fr auto;
    }
    .grid-container.chat-term .bottom-pane { border-top: 1px solid #2a2a2a; min-height: 120px; max-height: 300px; }
    .pane {
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-height: 0;
    }
    .pane > * { flex: 1; min-height: 0; }
    .resize-handle {
      height: 4px;
      cursor: ns-resize;
      background: transparent;
      flex-shrink: 0;
    }
    .resize-handle:hover { background: #6366f1; }
    .body {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    .body > .grid-container { flex: 1; }
    .body > vc-explorer { flex-shrink: 0; }
    .landing {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 16px;
      padding: 40px;
      background: radial-gradient(ellipse at top, rgba(129,140,248,.08) 0%, transparent 60%);
    }
    .landing-logo { opacity: .9; margin-bottom: 8px; }
    .landing-title {
      margin: 0;
      font-size: 32px;
      font-weight: 700;
      color: var(--text-primary, #e5e5e5);
      letter-spacing: -1px;
      font-family: 'Menlo', 'Monaco', monospace;
    }
    .landing-subtitle {
      margin: 0;
      font-size: 13px;
      color: var(--text-secondary, #888);
    }
    .landing-btn {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 16px;
      padding: 14px 32px;
      background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%);
      color: #fff;
      border: none;
      border-radius: 10px;
      cursor: pointer;
      font-size: 14px;
      font-weight: 700;
      letter-spacing: 1px;
      box-shadow: 0 4px 20px rgba(245,158,11,.3);
      transition: transform .15s, box-shadow .15s;
    }
    .landing-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 30px rgba(245,158,11,.45);
    }
    .landing-btn-plus {
      font-size: 20px;
      font-weight: 400;
      line-height: 1;
    }
    .landing-hint {
      margin: 0;
      font-size: 11px;
      color: var(--text-secondary, #666);
    }
    .landing-hint kbd {
      background: var(--bg-tertiary, #222);
      border: 1px solid var(--border, #2a2a2a);
      border-radius: 3px;
      padding: 1px 5px;
      font-family: monospace;
      margin: 0 2px;
    }
    .main-area { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; }
    .content-area { flex: 1; display: flex; min-height: 0; min-width: 0; overflow: hidden; }
  `

  @state() private commands: Command[] = []
  @state() private models: ModelInfo[] = []
  @state() private notifications: Notification[] = []
  @state() private showNewTabDialog = false
  @state() private showPairing = false
  @state() private mode: 'prompt' | 'bash' = 'prompt'
  @state() private sidebarOpen = true
  @state() private sidebarCwd = ''

  private client: DaemonClient

  constructor() {
    super()
    this.client = new DaemonClient()
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback()

    this.commands = await this.client.getCommands()
    this.models = await this.client.getModels()

    // Restore tabs: 1) active daemon sessions, 2) most recent CLI session (skip closed), 3) fresh session
    try {
      const initialModel = this.models[0]?.id ?? 'sonnet'
      const closedSessions = JSON.parse(localStorage.getItem('verboo_closed_sessions') || '[]') as string[]

      // 1) Active daemon sessions (survives F5 without re-opening closed tabs)
      const sessionsRes = await fetch('/api/v1/sessions')
      const sessionsData = sessionsRes.ok ? await sessionsRes.json() as { sessions?: Array<{ id: string; model: string; title?: string; cwd: string; messageCount: number }> } : { sessions: [] }
      const daemonActive = (sessionsData.sessions ?? []).filter((s: { id: string; messageCount: number }) => s.messageCount > 0 && !closedSessions.includes(s.id))

      if (daemonActive.length > 0) {
        for (const s of daemonActive) {
          tabStore.add({
            id: s.id, title: s.title || 'main', type: 'sdk',
            cwd: s.cwd, model: s.model ?? initialModel,
            state: 'idle', messages: [], streamingText: '', streamingThinking: '',
            isProcessing: false, permissionMode: 'acceptEdits',
          })
          this.setupClientCallbacks(s.id)
        }
        this.client.switchSession(daemonActive[0].id)
        tabStore.setActive(daemonActive[0].id)
        this.syncSidebarCwd()
        return
      }

      // 2) No active daemon sessions — create fresh session.
      // CLI sessions are only resumed explicitly via "New Tab → Resume".
      // Auto-resuming the most recent CLI session would re-open the very
      // session that the user just closed (or the one running this CLI).

      // 3) Nothing resumed — create fresh session
      if (tabStore.getTabs().length === 0) {
        const session = await this.client.createSession(initialModel)
        tabStore.add({
          id: session.id, title: 'main', type: 'sdk',
          cwd: session.cwd, model: session.model ?? initialModel,
          state: 'idle', messages: [], streamingText: '', streamingThinking: '', isProcessing: false,
          permissionMode: 'acceptEdits',
        })
        this.setupClientCallbacks(session.id)
        this.client.switchSession(session.id)
        this.syncSidebarCwd()
        this.refreshExplorer()
      }

      connectionStore.setConnected(true)
      this.requestUpdate()
    } catch (err) {
      this.addNotification(`Failed to create initial session: ${(err as Error).message}`, 'high')
    }
  }

  private refreshExplorer(tabId?: string): void {
    const explorer = this.renderRoot.querySelector('vc-explorer') as any
    if (explorer && explorer.cwd) {
      explorer.refresh()
    }
  }

  private setupClientCallbacks(tabId: string): void {
    const sessionId = tabStore.get(tabId)?.id ?? tabId

    // Register per-session streaming callback (isolated per tab).
    // Client.registerStreamCallback is idempotent — won't overwrite existing.
    this.client.registerStreamCallback(sessionId, (event) => {
      this.handleStreamEvent(tabId, event)
      this.requestUpdate()
    })

    // Register per-session transcript callback (also idempotent)
    this.client.registerTranscriptCallback(sessionId, (entry) => {
      this.handleTranscriptAppend(tabId, entry)
      this.requestUpdate()
    })

    // Global: session state changes (not per-tab)
    this.client.onStateChange = (state) => {
      tabStore.updateState(tabId, state)
      if (state === 'idle') tabStore.finalizeStreaming(tabId)
      this.requestUpdate()
    }

    // Lock changes (CLI vs Web coordination)
    this.client.onLockChange = (locked, owner) => {
      if (locked && owner === 'cli') {
        this.addNotification('CLI terminal is active on this session. Web input is locked.', 'medium', 3000)
      } else if (!locked) {
        this.addNotification('Session lock released. You can send messages.', 'low', 2000)
      }
      this.requestUpdate()
    }

    // Error handling
    this.client.onError = (err) => {
      this.addNotification(`Error: ${err}`, 'high')
    }
  }

  private handleTranscriptAppend(tabId: string, entry: unknown): void {
    const e = entry as Record<string, unknown>
    // Normalize content: can be string, array, or undefined
    const normalizeContent = (raw: unknown): Array<Record<string, unknown>> => {
      if (!raw) return []
      if (typeof raw === 'string') return [{ type: 'text', text: raw }]
      if (Array.isArray(raw)) return raw as Array<Record<string, unknown>>
      return []
    }
    // JSONL transcript entries have: type, message, uuid, parentUuid, etc.
    // We only care about user/assistant messages for the chat view
    if (e.type === 'user' && e.message) {
      const msg = e.message as { role: string; content: unknown }
      const blocks = normalizeContent(msg.content)
      const textBlocks = blocks.filter((b: any) => b.type === 'text' && b.text)
      const toolBlocks = blocks.filter((b: any) => b.type === 'tool_use' && b.name)
      if (textBlocks.length > 0 || toolBlocks.length > 0) {
        tabStore.appendMessage(tabId, {
          id: `cli-user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          content: blocks.map((b: any) => {
            if (b.type === 'text') return { type: 'text', text: b.text }
            if (b.type === 'tool_use') return { type: 'tool_use', name: b.name, input: b.input }
            return { type: 'text', text: '' }
          }),
        } as Message)
      }
    } else if (e.type === 'assistant' && e.message) {
      const msg = e.message as { role: string; content: unknown }
      const blocks = normalizeContent(msg.content)
      const hasContent = blocks.some((b: any) => {
        if (b.type === 'text' && b.text) return true
        if (b.type === 'thinking' && b.thinking) return true
        if (b.type === 'tool_use' && b.name) return true
        return false
      })
      if (hasContent) {
        const contentArr = blocks.map((b: any) => {
          if (b.type === 'text') return { type: 'text', text: b.text || '' }
          if (b.type === 'thinking') return { type: 'thinking', thinking: b.thinking || '' }
          if (b.type === 'tool_use') return { type: 'tool_use', name: b.name, input: b.input }
          return { type: 'text', text: '' }
        })
        tabStore.appendMessage(tabId, {
          id: `cli-assistant-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'assistant',
          content: contentArr,
          model: (e as any).message?.model,
        } as Message)
      }
    }
  }

  private handleStreamEvent(tabId: string, event: StreamEvent): void {
    const e = event as Record<string, unknown>
    switch (e.type) {
      case 'text':
        tabStore.appendStreamingText(tabId, (e as { text: string }).text)
        break
      case 'thinking':
        tabStore.appendStreamingThinking(tabId, (e as { thinking: string }).thinking)
        break
      case 'tool_use': {
        const tu = e as unknown as { id: string; name: string; input: unknown }
        this.toolStartTimes.set(tabId + ':' + tu.id, Date.now())
        tabStore.appendMessage(tabId, {
          id: tu.id, role: 'assistant',
          content: [{ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input }],
          status: 'running',
        } as Message & { status?: string })
        // Detect memory save: Write tool targeting memory directory
        if (tu.name === 'Write' && typeof tu.input === 'object' && tu.input !== null) {
          const filePath = (tu.input as { file_path?: string }).file_path ?? ''
          if (/\/(memory|memories)\//.test(filePath)) {
            this.pendingMemorySaves.set(tabId + ':' + tu.id, filePath)
          }
        }
        // Detect task-management tool calls (MCP or plugin format)
        // Matches: mcp__<server>__add_task/update_task and plugin:<server>:<server> - ...
        const taskToolMatch = /^(mcp__[\w]+__|plugin:[\w:]+ - )?(add_task|update_task|create_task|set_task|complete_task)$/.exec(tu.name)
        if (taskToolMatch && typeof tu.input === 'object' && tu.input !== null) {
          const input = tu.input as { task_id?: string; id?: string; objective?: string; subject?: string; description?: string; status?: string }
          const taskId = input.task_id ?? input.id
          const subject = input.objective ?? input.subject ?? input.description
          const status = input.status
          if (taskId && subject) {
            this.updateTask(tabId, { id: taskId, subject, status: this.normalizeTaskStatus(status) })
          }
        }
        break
      }
      case 'tool_result': {
        const tr = e as unknown as { tool_use_id: string; content: unknown; is_error?: boolean }
        const durKey = tabId + ':' + tr.tool_use_id
        const startTime = this.toolStartTimes.get(durKey)
        const durationMs = startTime ? Date.now() - startTime : undefined
        this.toolStartTimes.delete(durKey)
        tabStore.updateToolStatus(tabId, tr.tool_use_id, tr.is_error ? 'error' : 'done', durationMs)
        // If this was a memory write, show notification
        const memKey = tabId + ':' + tr.tool_use_id
        const memPath = this.pendingMemorySaves.get(memKey)
        if (memPath) {
          const name = memPath.split('/').pop() ?? 'memory'
          this.enqueueMemorySave(tabId, name)
          this.pendingMemorySaves.delete(memKey)
        }
        tabStore.appendMessage(tabId, {
          id: `result-${tr.tool_use_id}`, role: 'user',
          content: [{ type: 'tool_result', tool_use_id: tr.tool_use_id, content: typeof tr.content === 'string' ? tr.content : JSON.stringify(tr.content), is_error: tr.is_error }],
        } as Message)
        break
      }
      case 'assistant': {
        // Full assistant message. 'text' events cover most streaming, but
        // text after tool_use/tool_result may only arrive here. Append only
        // when streamingText is empty (no prior text events for this segment).
        const msg = (e as unknown as { message: { content: Array<{ type: string; text?: string }> } }).message
        if (msg?.content) {
          for (const block of msg.content) {
            if (block.type === 'text' && block.text) {
              const tab = tabStore.get(tabId)
              if (tab && !tab.streamingText.endsWith(block.text)) {
                tabStore.appendStreamingText(tabId, block.text)
              }
            }
          }
        }
        break
      }
      case 'result':
      case 'message_stop': {
        // Capture usage info for status bar display
        const resultData = e as unknown as { usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number }; total_cost_usd?: number }
        if (resultData.usage) {
          const u = resultData.usage
          tabStore.updateContextUsage(tabId, {
            input: u.input_tokens ?? 0,
            output: u.output_tokens ?? 0,
            cacheRead: u.cache_read_input_tokens ?? 0,
            cacheCreation: u.cache_creation_input_tokens ?? 0,
            costUSD: resultData.total_cost_usd ?? 0,
          })
        }
        tabStore.finalizeStreaming(tabId)
        break
      }
      case 'system': {
        const sys = e as { subtype?: string; model?: string }
        if (sys.subtype === 'init' && sys.model) {
          tabStore.updateModel(tabId, sys.model)
        }
        if (sys.subtype === 'init') {
          tabStore.updateState(tabId, 'running')
        }
        break
      }
      case 'error':
        tabStore.updateState(tabId, 'error')
        this.addNotification((e as { error: string }).error, 'high')
        break
    }
  }

  disconnectedCallback(): void {
    this.client.disconnect()
    super.disconnectedCallback()
  }

  private async onSubmit(e: CustomEvent<{ message: string }>): Promise<void> {
    const tab = tabStore.getActive()
    if (!tab || !e.detail.message.trim()) return

    const tabId = tabStore.getActiveId()!
    const msg = e.detail.message

    // Add user message to UI immediately
    tabStore.appendMessage(tabId, {
      id: `user-${Date.now()}`,
      role: 'user',
      content: [{ type: 'text', text: msg }],
    } as Message)
    tabStore.updateState(tabId, 'running')
    this.requestUpdate()

    try {
      // Send message with sessionId for per-tab event routing
      await this.client.sendMessage(tabId, msg)
    } catch (err) {
      this.addNotification(`Send failed: ${(err as Error).message}`, 'high')
      tabStore.updateState(tabId, 'idle')
    }
  }

  private async onNewTab(): Promise<void> {
    this.showNewTabDialog = true
  }

  private async onTerminalClosedFromGrid(e: CustomEvent<{ terminalId: string }>): Promise<void> {
    const { terminalId } = e.detail
    if (!terminalId || terminalId.endsWith('-pending')) return
    try { await this.client.destroySession(terminalId) } catch {}
    tabStore.remove(terminalId)
  }

  private onTabCreated(e: CustomEvent<{ tab: { id: string; type: string; title?: string; pid?: number; cwd: string; model?: string }; transcriptEntries?: Array<{ type: string; message?: { role: string; content: Array<{ type: string; text?: string }> } }> }>): void {
    const { tab, transcriptEntries } = e.detail
    tabStore.add({
      id: tab.id,
      title: tab.title ?? tab.id.slice(0, 8),
      type: (tab.type as 'sdk' | 'pty' | 'attach') ?? 'pty',
      cwd: tab.cwd,
      model: tab.model ?? 'ultra/glm-5.2',
      state: 'idle',
      messages: [],
      streamingText: '',
      streamingThinking: '',
      isProcessing: false,
      pid: tab.pid,
      permissionMode: 'acceptEdits',
    })
    tabStore.setActive(tab.id)
    // Persist last session ID so F5 can resume it
    if (tab.type === 'sdk') {
      localStorage.setItem('verboo_last_session', tab.id)
    }
    // Switch WebSocket to the new session and wire callbacks
    this.client.switchSession(tab.id)
    this.setupClientCallbacks(tab.id)
    // Process transcript history entries (from CLI session resume)
    if (transcriptEntries?.length) {
      for (const entry of transcriptEntries) {
        this.handleTranscriptAppend(tab.id, entry)
      }
    }
    this.syncSidebarCwd()
    this.requestUpdate()
  }

  private async onTabClose(e: CustomEvent<{ id: string }>): Promise<void> {
    const tabId = e.detail.id
    try { await this.client.destroySession(tabId) } catch {}
    const closed = JSON.parse(localStorage.getItem('verboo_closed_sessions') || '[]') as string[]
    if (!closed.includes(tabId)) closed.push(tabId)
    localStorage.setItem('verboo_closed_sessions', JSON.stringify(closed))
    // Clean up per-session callbacks
    this.client.unregisterStreamCallback(tabId)
    this.client.unregisterTranscriptCallback(tabId)
    tabStore.remove(tabId)
    this.requestUpdate()
    this.syncSidebarCwd()
    this.refreshExplorer()
  }

  private onTabSelected(): void {
    const tab = tabStore.getActive()
    if (tab) {
      tabStore.clearStreaming(tab.id)
      // Switch WebSocket to the newly active session for live sync
      this.client.switchSession(tab.id)
      // Only register callbacks if not already registered (preserves in-flight streams)
      this.setupClientCallbacks(tab.id)
      this.requestUpdate()
    }
  }

  private async onInterrupt(): Promise<void> {
    const tab = tabStore.getActive()
    if (tab) {
      try { await this.client.interrupt() } catch {}
      tabStore.updateState(tab.id, 'idle')
    }
  }

  private async onPermissionChange(e: CustomEvent<{ mode: string }>): Promise<void> {
    const tab = tabStore.getActive()
    if (!tab) return
    tabStore.setPermissionMode(tab.id, e.detail.mode as 'default' | 'acceptEdits' | 'plan' | 'bypassPermissions')
    try {
      await this.client.setPermission(tab.id, e.detail.mode)
    } catch (err) {
      // Session may be stale (not in daemon). Log but don't spam notification.
      console.warn('setPermission failed (stale session?):', (err as Error).message)
    }
    this.addNotification(`Permission: ${e.detail.mode}`, 'low', 1500)
  }

  private onModeChange(e: CustomEvent<'prompt' | 'bash'>): void {
    this.mode = e.detail
  }

  private addNotification(text: string, level: Notification['level'], dismissAfter = 5000): void {
    const id = `notif-${Date.now()}`
    this.notifications = [...this.notifications, { id, text, level, dismissAfter }]
    if (dismissAfter > 0) {
      setTimeout(() => {
        this.notifications = this.notifications.filter((n) => n.id !== id)
      }, dismissAfter)
    }
  }

  private enqueueMemorySave(tabId: string, name: string): void {
    let entry = this.memoryAggQueue.get(tabId)
    if (!entry) {
      entry = { names: [], timer: 0 }
      this.memoryAggQueue.set(tabId, entry)
    }
    entry.names.push(name)
    if (entry.timer) clearTimeout(entry.timer)
    entry.timer = window.setTimeout(() => this.flushMemoryAgg(tabId), 2000)
  }

  private flushMemoryAgg(tabId: string): void {
    const entry = this.memoryAggQueue.get(tabId)
    if (!entry || entry.names.length === 0) return
    const names = entry.names
    this.memoryAggQueue.delete(tabId)
    if (entry.timer) clearTimeout(entry.timer)
    const n = names.length
    const list = names.map((nm) => `  - ${nm}`).join('\n')
    const text = n === 1 ? `Saved memory: ${names[0]}` : `Saved ${n} memories\n${list}`
    tabStore.appendMessage(tabId, {
      id: `sys-${Date.now()}`,
      role: 'system',
      subtype: 'saved_memories',
      text,
    } as Message)
    this.addNotification(n === 1 ? `Saved ${names[0]}` : `Saved ${n} memories`, 'low', 3000)
  }

  @state() private showModelPicker: { tabId: string; current: string } | null = null
  @state() private showFilePicker: { tabId: string; path: string } | null = null
  private pendingMemorySaves = new Map<string, string>() // tool_use_id → file_path
  private toolStartTimes = new Map<string, number>() // tabId:toolUseId → start timestamp
  private memoryAggQueue = new Map<string, { names: string[]; timer: number }>() // tabId → pending aggregate
  @state() private tasksByTab = new Map<string, Array<{ id: string; subject: string; status: string }>>()
  @state() private bottomHeight = 200
  private resizeStart = 0
  private resizeStartHeight = 0

  private onResizeStart(e: MouseEvent): void {
    this.resizeStart = e.clientY
    this.resizeStartHeight = this.bottomHeight
    const onMove = (ev: MouseEvent) => {
      this.bottomHeight = Math.max(120, Math.min(400, this.resizeStartHeight - (ev.clientY - this.resizeStart)))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  private async onSearchSelect(e: CustomEvent<{ type: string; sessionId?: string; path?: string }>): Promise<void> {
    const { type, sessionId, path } = e.detail
    if (type === 'session' && sessionId) {
      try {
        const activeTab = tabStore.getActive()
        const cwd = activeTab?.cwd || '/home/alvaro/verboo-code'
        const res = await fetch(`/api/v1/sessions/${sessionId}/resume`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cwd }),
        })
        if (res.ok) {
          const data = await res.json() as { session: { id: string; cwd: string; model?: string; transcriptEntries?: unknown[] } }
          tabStore.add({
            id: data.session.id, title: 'resumed', type: 'sdk',
            cwd: data.session.cwd, model: data.session.model ?? 'ultra/glm-5.2',
            state: 'idle', messages: [], streamingText: '', streamingThinking: '',
            isProcessing: false, permissionMode: 'acceptEdits',
          })
          this.setupClientCallbacks(data.session.id)
          tabStore.setActive(data.session.id)
          this.client.switchSession(data.session.id)
          if (data.session.transcriptEntries?.length) {
            for (const entry of data.session.transcriptEntries) {
              this.handleTranscriptAppend(data.session.id, entry)
            }
          }
          this.syncSidebarCwd()
        }
      } catch (err) {
        this.addNotification(`Failed to resume: ${(err as Error).message}`, 'high')
      }
    } else if (type === 'command') {
      this.showNewTabDialog = true
    } else if (type === 'file' && path) {
      // Just open the file in editor — for now log it
      this.addNotification(`File: ${path}`, 'low', 2000)
    }
  }

  /** Render a vc-chat-panel for an SDK tab */
  private renderChatPanel(t: TabState, isPrimary: boolean): unknown {
    const modelInfo = this.models.find((m: { id: string }) => m.id === t.model)
    const tasks = this.tasksByTab.get(t.id) ?? []
    return html`<vc-chat-panel
      .messages=${t.messages}
      .streamingText=${t.streamingText}
      .streamingThinking=${t.streamingThinking}
      .isProcessing=${t.isProcessing ?? false}
      .sessionTitle=${t.title}
      .model=${t.model ?? 'ultra/glm-5.2'}
      .cwd=${t.cwd ?? '/'}
      .models=${this.models}
      .tasks=${tasks}
      .contextUsed=${t.contextUsage?.input ?? 0}
      .contextLimit=${modelInfo?.contextWindow ?? 200000}
      .inputTokens=${t.contextUsage?.input ?? 0}
      .outputTokens=${t.contextUsage?.output ?? 0}
      .permissionMode=${t.permissionMode ?? 'acceptEdits'}
      .commands=${this.commands}
      .mode=${this.mode}
      .notifications=${this.notifications}
      @submit=${(e: CustomEvent) => this.onSubmitWithTab(t.id, e)}
      @interrupt=${this.onInterrupt}
      @mode-change=${this.onModeChange}
      @permission-change=${this.onPermissionChange}
      @open-model-picker=${() => this.openModelPicker(t)}
      @file-pick=${() => (this.showFilePicker = { tabId: t.id, path: t.cwd })}
    ></vc-chat-panel>`
  }

  private async onSubmitWithTab(tabId: string, e: CustomEvent): Promise<void> {
    // Redirect submit to the correct tab
    const active = tabStore.getActive()
    if (active?.id !== tabId) {
      tabStore.setActive(tabId)
      this.client.switchSession(tabId)
      this.setupClientCallbacks(tabId)
      this.requestUpdate()
    }
    // Flush any pending memory-save aggregate so user sees it before their next message
    this.flushMemoryAgg(tabId)
    const msg = typeof e.detail === 'string' ? e.detail : (e.detail as { message?: string }).message ?? ''
    if (msg.trim()) {
      await this.client.sendMessage(tabId, msg)
    }
  }

  private normalizeTaskStatus(status: string | undefined): string {
    if (!status) return 'pending'
    const s = status.toLowerCase()
    if (s === 'done' || s === 'completed' || s === 'complete') return 'done'
    if (s === 'active' || s === 'in_progress' || s === 'in-progress') return 'in_progress'
    if (s === 'blocked') return 'blocked'
    return 'pending'
  }

  private updateTask(tabId: string, task: { id: string; subject: string; status: string }): void {
    const list = this.tasksByTab.get(tabId) ?? []
    const idx = list.findIndex(t => t.id === task.id)
    if (idx >= 0) {
      list[idx] = { ...list[idx], ...task }
    } else {
      list.push(task)
    }
    this.tasksByTab.set(tabId, list)
    this.requestUpdate()
  }

  /** Sync current tabs to server-side cache */

  private openModelPicker(t: TabState): void {
    this.showModelPicker = { tabId: t.id, current: t.model ?? 'ultra/glm-5.2' }
  }

  private syncSidebarCwd(): void {
    const active = tabStore.getActive()
    this.sidebarCwd = active?.cwd ?? ''
    // setting sidebarCwd (@state) already schedules requestUpdate
    // refreshExplorer moved to updated() lifecycle
  }

  updated(changed: Map<string, unknown>): void {
    if (changed.has('sidebarCwd')) {
      this.refreshExplorer()
    }
  }

  private async onModelPicked(e: CustomEvent<{ model: string }>): Promise<void> {
    if (!this.showModelPicker) return
    const { tabId } = this.showModelPicker
    const model = e.detail.model
    tabStore.updateModel(tabId, model)
    this.showModelPicker = null
    try {
      await this.client.setModel(tabId, model)
    } catch { /* ignore */ }
  }

  render(): unknown {
    const activeTab = tabStore.getActive()
    const allTabs = tabStore.getTabs()
    const hasTabs = allTabs.length > 0
    const activeIsPty = activeTab?.type === 'pty'
    const activeIsSdk = activeTab?.type === 'sdk'

    return html`
      <vc-header
        .connected=${connectionStore.isConnected()}
        @open-pairing=${() => { this.showPairing = true }}
        @theme-change=${() => this.requestUpdate()}
        @toggle-explorer=${() => { this.sidebarOpen = !this.sidebarOpen; this.requestUpdate() }}
      ></vc-header>
      <div class="body">
        <vc-explorer
          .cwd=${this.sidebarCwd}
          style="width:${this.sidebarOpen ? 300 : 0}px;overflow:hidden;transition:width .2s ease;flex-shrink:0"
        ></vc-explorer>
        <div class="main-area">
          <vc-tabs-bar
            @new-tab=${this.onNewTab}
            @tab-close=${this.onTabClose}
            @tab-selected=${this.onTabSelected}
          ></vc-tabs-bar>
          <div class="content-area">
            ${activeTab ? this.renderChatPanel(activeTab, true) : html`
              <div class="landing">
                <div class="landing-logo">
                  <svg viewBox="0 0 32 32" width="56" height="56" fill="url(#logo-grad)">
                    <defs>
                      <linearGradient id="logo-grad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stop-color="#818cf8"/>
                        <stop offset="100%" stop-color="#c084fc"/>
                      </linearGradient>
                    </defs>
                    <path d="M16 2 L29 10 V22 L16 30 L3 22 V10 Z" stroke="url(#logo-grad)" stroke-width="2" fill="none" stroke-linejoin="round"/>
                    <circle cx="16" cy="16" r="4" fill="url(#logo-grad)"/>
                  </svg>
                </div>
                <h1 class="landing-title">Verboo</h1>
                <p class="landing-subtitle">Your AI coding session, in the browser</p>
                <button class="landing-btn" @click=${this.onNewTab}>
                  <span class="landing-btn-plus">+</span>
                  <span>NEW SESSION</span>
                </button>
                <p class="landing-hint">or press <kbd>↑</kbd> then <kbd>Enter</kbd> on a CLI session · <kbd>Cmd+K</kbd> to search</p>
              </div>`}
          </div>
        </div>
      </div>

      <vc-command-palette @select=${this.onSearchSelect}></vc-command-palette>

      ${when(this.showPairing, () => html`
        <vc-pairing-dialog
          .url=${window.location.origin}
          @close=${() => (this.showPairing = false)}
        ></vc-pairing-dialog>
      `)}
      ${when(this.showNewTabDialog, () => html`
        <vc-dialog-new-tab
          .client=${this.client}
          .models=${this.models}
          @close=${() => (this.showNewTabDialog = false)}
          @tab-created=${this.onTabCreated}
        ></vc-dialog-new-tab>
      `)}
      ${when(this.showModelPicker, () => html`
        <vc-model-picker
          .models=${this.models}
          .current=${this.showModelPicker!.current}
          @close=${() => (this.showModelPicker = null)}
          @select=${this.onModelPicked}
        ></vc-model-picker>
      `)}
      ${when(this.showFilePicker, () => html`
        <vc-file-picker
          .initialPath=${this.showFilePicker!.path}
          .showFiles=${true}
          title="Insert file reference"
          @close=${() => (this.showFilePicker = null)}
          @select=${(e: CustomEvent) => {
            this.showFilePicker = null
          }}
        ></vc-file-picker>
      `)}
    `
  }
}
