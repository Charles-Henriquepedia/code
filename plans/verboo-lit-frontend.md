# Verboo Lit Frontend — Plano Arquitetural

## Stack

| Tecnologia | Função |
|---|---|
| **Lit** | Web components, shadow DOM, reactive state |
| **lit-html** | Templates, `repeat`, `classMap`, `styleMap`, `until` |
| **TypeScript** | Tipagem, decorators (`@customElement`, `@property`, `@state`) |
| **WebSocket** | Streaming bidirecional (chat, eventos) |
| **SSE** | Streaming unidirecional (respostas longas, init) |
| **Vite** | Build, dev server, HMR |
| **CSS** | Scoped styles via Lit (`css` tagged template) |

## Arquitetura de Componentes

### Camadas

```
app-shell                  # Layout raiz: header + main + footer
├── vc-header              # Status bar (modelo, modo, tokens)
├── vc-main                # Scrollable conversation area
│   ├── vc-logo-header     # Logo + status notices
│   ├── vc-message-list    # Lista virtualizada de mensagens
│   │   └── vc-message     # Renderiza qualquer tipo de mensagem
│   │       ├── vc-message-user
│   │       ├── vc-message-assistant
│   │       ├── vc-message-system
│   │       ├── vc-message-tool-result
│   │       └── vc-message-thinking
│   ├── vc-streaming-text  # Texto sendo streamado
│   ├── vc-thinking-block  # Thinking sendo streamado
│   └── vc-spinner         # Loading spinner com status
└── vc-footer              # Input + dialogs
    ├── vc-prompt-input    # Campo de texto principal
    │   ├── vc-text-input          # Textarea com triggers
    │   ├── vc-slash-commands      # Autocomplete /
    │   ├── vc-at-mentions         # Autocomplete @
    │   ├── vc-typeahead           # Sugestões
    │   └── vc-trigger-highlights  # Realce de triggers (/think, /btw, token budget)
    ├── vc-notifications    # Barra de notificações
    └── vc-status-line      # Status line customizável

# Dialogs (overlays)
vc-dialog-stats           # Stats dialog (Overview + Models tabs)
vc-dialog-background-tasks # Background tasks list/detail
vc-dialog-model-picker    # Model selection
vc-dialog-context         # Context visualization
vc-dialog-help            # Keyboard shortcuts help
vc-dialog-teams           # Agent teams/swarm
```

### Árvore de Componentes Detalhada

```
<body>
  <vc-app-shell>
    #--- Header ---
    <vc-header>
      <vc-model-badge model="sonnet" />
      <vc-mode-indicator mode="prompt" />
      <vc-token-usage percent="45" />
      <vc-connection-status connected />
      <vc-header-actions>
        <button @click=${this.openStats}>Stats</button>
        <button @click=${this.openContext}>Context</button>
        <button @click=${this.openSettings}>⚙</button>
      </vc-header-actions>
    </vc-header>

    #--- Main (scrollable) ---
    <vc-main @scroll=${this.onScroll}>
      <vc-logo-header .notices=${notices}></vc-logo-header>

      <vc-message-list .messages=${messages}>
        ${repeat(this.messages, (m) => m.id, (m, idx) => html`
          <vc-message
            .message=${m}
            .isLast=${idx === this.messages.length - 1}
            .verbose=${this.verbose}
          ></vc-message>
        `)}
      </vc-message-list>

      <!-- Streaming -->
      ${this.isStreaming ? html`
        <vc-streaming-text .text=${this.streamingText}></vc-streaming-text>
        ${this.streamingThinking ? html`
          <vc-thinking-block .thinking=${this.streamingThinking}></vc-thinking-block>
        ` : ''}
      ` : ''}

      <!-- Spinner -->
      ${this.isProcessing ? html`
        <vc-spinner .mode=${this.mode} .elapsed=${this.elapsed} .tip=${this.spinnerTip}></vc-spinner>
      ` : ''}
    </vc-main>

    #--- Footer (fixed) ---
    <vc-footer>
      <vc-notifications .items=${notifications}></vc-notifications>
      <vc-prompt-input
        @submit=${this.onSubmit}
        .commands=${commands}
        .agents=${agents}
        .mode=${mode}
        .disabled=${isProcessing}
      >
        <vc-text-input .value=${input}></vc-text-input>
      </vc-prompt-input>
      <vc-status-line .data=${statusData}></vc-status-line>
    </vc-footer>
  </vc-app-shell>
</body>
```

## Mapeamento Terminal → Web

### Features Core (100% - Essenciais)

| Terminal | Web (Lit) | Status |
|---|---|---|
| `REPL.tsx` | `<vc-app-shell>` + `<vc-header>` + `<vc-main>` + `<vc-footer>` | Essencial |
| `Messages.tsx` | `<vc-message-list>` com virtual scroll (`repeat` com keyFn) | Essencial |
| `Message.tsx` (6 tipos) | `<vc-message>` com switch type → sub-componentes | Essencial |
| `User text` | `<vc-message-user>` com markdown render | Essencial |
| `Assistant text` | `<vc-message-assistant>` com markdown render | Essencial |
| `Tool_use` | `<vc-tool-use>` com nome, input, status (running/done/error) | Essencial |
| `Tool_result` | `<vc-tool-result>` com output colapsável | Essencial |
| `System message` | `<vc-message-system>` | Essencial |
| `Thinking` | `<vc-thinking-block>` (collapsible) | Essencial |
| `PromptInput` | `<vc-prompt-input>` + `<vc-text-input>` | Essencial |
| `SpinnerWithVerb` | `<vc-spinner>` com animação CSS, elapsed time, tip cycling | Essencial |
| `StatusLine` | `<vc-status-line>` | Essencial |
| `Notifications` | `<vc-notifications>` (queue com prioridades, auto-dismiss 5s) | Essencial |
| Streaming | WebSocket `stream_event` → `vc-streaming-text` + `vc-thinking-block` | Essencial |
| `/` commands | `<vc-slash-commands>` autocomplete dropdown | Essencial |
| Markdown render | `vc-markdown` (marked + DOMPurify) | Essencial |

### Features Secundárias (Prioridade Alta)

| Terminal | Web (Lit) | Status |
|---|---|---|
| TokenWarning | `<vc-token-usage>` no header (%, cor, warning/error) | Alta |
| ContextVisualization | `<vc-dialog-context>` | Alta |
| Stats dialog | `<vc-dialog-stats>` (Overview + Models tabs) | Alta |
| Background tasks | `<vc-dialog-background-tasks>` | Alta |
| Model picker | `<vc-dialog-model-picker>` | Alta |
| Ctrl+O transcript | `<vc-transcript-mode>` toggle com search bar | Alta |
| Grouped tool_use | `<vc-grouped-tool-use>` collapsible | Alta |
| Collapsed read/search | `<vc-collapsed-content>` | Alta |
| Help menu | `<vc-dialog-help>` 3-col layout | Alta |
| Cursor mode | `<vc-message-actions-bar>` | Alta |

### Features Terciárias (Prioridade Média)

| Terminal | Web (Lit) | Status |
|---|---|---|
| History search (Ctrl+R) | `<vc-dialog-history-search>` | Média |
| Quick open (Ctrl+P) | `<vc-dialog-quick-open>` | Média |
| Teams dialog | `<vc-dialog-teams>` | Média |
| Bridge dialog | `<vc-dialog-bridge>` | Média |
| Stash prompt | `<vc-stash-notice>` | Média |
| Input triggers | `/think`, `/btw`, `/ultraplan`, token budget highlights | Média |
| @mentions | `<vc-at-mentions>` com member color highlights | Média |
| Image references | `[Image ...]` highlights | Média |
| Streaming tool use | Tool calls aparecendo durante streaming | Média |
| Undo (Ctrl+Backspace) | Undo no input | Média |

### Features Opcionais (Prioridade Baixa)

| Terminal | Web (Lit) | Status |
|---|---|---|
| Vim mode | `<vc-vim-text-input>` | Baixa |
| Teammate viewer | `<vc-teammate-view>` | Baixa |
| Audio/voice | Voice indicators | Baixa |
| Companheiro | `<vc-companion-sprite>` | Baixa |
| Auto-mode opt-in | Dialog | Baixa |
| Feedback surveys | Modal surveys | Baixa |
| Swarm banner | Colored agent indicators | Baixa |
| External editor | "Save and close editor" notice | Baixa |

## Streaming Protocol

### Conexão WebSocket

```typescript
// Client → Server
interface WsClientMessage {
  type: 'input' | 'command' | 'interrupt' | 'keep_alive'
  message?: string     // input/command content
  command?: string     // command name
  args?: string[]      // command args
  sessionId: string
}

// Server → Client (via WS ou SSE)
interface WsServerMessage {
  type: 'stream_event' | 'session_state' | 'error' | 'connected' | 'keep_alive'
  sessionId: string
  event?: StreamEvent
  state?: 'idle' | 'running' | 'requires_action'
  error?: string
}
```

### Fluxo de Conversa

```
1. User digita "hello" no <vc-prompt-input>
2. <vc-prompt-input> emite evento @submit
3. <vc-app-shell> envia WebSocket: { type: 'input', message: 'hello', sessionId }
4. <vc-spinner> aparece (isProcessing = true)
5. Server streama eventos:
   event: stream_event → { type: 'system', subtype: 'init', ... }
   event: stream_event → { type: 'text', text: 'Hello!' }
   event: stream_event → { type: 'tool_use', name: 'Bash', ... }
   event: stream_event → { type: 'tool_result', ... }
   event: stream_event → { type: 'text', text: 'Done!' }
6. A cada evento, <vc-message-list> atualiza
7. <vc-streaming-text> mostra texto incremental
8. Ao finalizar, <vc-spinner> desaparece
9. <vc-message-list> mostra mensagem completa
```

## Estrutura de Diretórios

```
lit-frontend/
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
└── src/
    ├── main.ts                    # Bootstrap: connect WS, create App
    ├── types.ts                   # Message, StreamEvent, Session, Command
    ├── api/
    │   ├── client.ts              # HTTP client (fetch API)
    │   ├── websocket.ts           # WebSocket connection management
    │   └── types.ts               # API request/response types
    ├── state/
    │   ├── session-store.ts       # Session state (Zustand-like store)
    │   ├── message-store.ts       # Messages array management
    │   └── connection-store.ts    # WS connection state
    ├── components/
    │   ├── app-shell.ts           # <vc-app-shell> - root layout
    │   ├── header.ts              # <vc-header> - status bar
    │   ├── main-view.ts           # <vc-main> - scrollable area
    │   ├── footer.ts              # <vc-footer> - input area
    │   ├── messages/
    │   │   ├── message-list.ts    # List with virtual scroll
    │   │   ├── message.ts         # Router: user | assistant | system
    │   │   ├── message-user.ts
    │   │   ├── message-assistant.ts
    │   │   ├── message-system.ts
    │   │   ├── message-tool-use.ts
    │   │   ├── message-tool-result.ts
    │   │   ├── message-thinking.ts
    │   │   └── message-grouped.ts
    │   ├── input/
    │   │   ├── prompt-input.ts    # Main input container
    │   │   ├── text-input.ts      # Contenteditable textarea
    │   │   ├── slash-commands.ts  # / autocomplete
    │   │   └── at-mentions.ts     # @ autocomplete
    │   ├── streaming/
    │   │   ├── streaming-text.ts
    │   │   └── thinking-block.ts
    │   ├── status/
    │   │   ├── spinner.ts         # Animated loading
    │   │   ├── status-line.ts     # Custom status line
    │   │   └── notifications.ts   # Notification queue
    │   └── dialogs/
    │       ├── dialog.ts          # Base dialog overlay
    │       ├── dialog-stats.ts
    │       ├── dialog-context.ts
    │       ├── dialog-tasks.ts
    │       ├── dialog-help.ts
    │       └── dialog-model-picker.ts
    └── utils/
        ├── markdown.ts            # Markdown → HTML
        ├── ansi.ts                # ANSI → HTML
        └── format.ts              # Token formatting, time, etc.
```

## Roadmap de Implementação

### Sprint 1 — Skeleton e Conexão (dias 1-3)

```
Objetivo: App renderizando, conectando ao daemon

- scaffold Vite + Lit + TypeScript
- <vc-app-shell> layout (header + main + footer)
- <vc-header> com model badge e status
- WebSocket client (connect/reconnect/keep-alive)
- Session store (criar sessão, gerenciar estado)
- <vc-main> com scroll container
```

**Componentes:** `app-shell.ts`, `header.ts`, `main-view.ts`
**Store:** `session-store.ts`, `connection-store.ts`

### Sprint 2 — Chat Básico (dias 4-6)

```
Objetivo: Enviar mensagem, receber SSE via WS, ver resposta

- <vc-prompt-input> + <vc-text-input> com @submit
- <vc-message-list> com render básico
- <vc-message> router
- <vc-message-user> + <vc-message-assistant> (text only)
- <vc-spinner> animado
- Streaming text em tempo real
```

**Componentes:** `prompt-input.ts`, `text-input.ts`, `message-list.ts`, `message.ts`, `message-user.ts`, `message-assistant.ts`, `spinner.ts`, `streaming-text.ts`

### Sprint 3 — Riqueza de Mensagens (dias 7-10)

```
Objetivo: Tool use, tool result, thinking, system messages

- <vc-message-tool-use> com status (running/done/error)
- <vc-message-tool-result> collapsible
- <vc-message-system>
- <vc-thinking-block> collapsible
- Markdown render (code blocks, tables, lists)
- ANSI render para tool results
- <vc-message-grouped> para tool use chains
```

**Componentes:** `message-tool-use.ts`, `message-tool-result.ts`, `message-system.ts`, `message-thinking.ts`, `message-grouped.ts`, `markdown.ts`, `ansi.ts`

### Sprint 4 — Input Avançado (dias 11-13)

```
Objetivo: Autocomplete, highlights, help

- <vc-slash-commands> dropdown
- <vc-at-mentions> dropdown
- Trigger highlights (/think, /btw, token budget)
- <vc-dialog-help> 3-col shortcuts
- History search (Ctrl+R)
- Undo support (Ctrl+Backspace)
```

**Componentes:** `slash-commands.ts`, `at-mentions.ts`, `dialog-help.ts`, `text-input.ts` (triggers)

### Sprint 5 — Dialogs Core (dias 14-16)

```
Objetivo: Stats, context, tasks

- <vc-dialog> base component
- <vc-dialog-stats> (Overview + Models tabs)
- <vc-dialog-context> com grid e breakdown
- <vc-dialog-tasks> list/detail
- <vc-dialog-model-picker>
```

**Componentes:** `dialog.ts`, `dialog-stats.ts`, `dialog-context.ts`, `dialog-tasks.ts`, `dialog-model-picker.ts`

### Sprint 6 — Polimento (dias 17-20)

```
Objetivo: Transcript mode, notifications, status line

- <vc-transcript-mode> (Ctrl+O toggle)
- Search bar com highlights e navegação
- <vc-notifications> queue + auto-dismiss
- <vc-status-line> customizável
- Tema escuro/claro
- Responsivo (mobile via daemon)
- Build + deploy
```

**Componentes:** `notifications.ts`, `status-line.ts`, tema CSS

## Exemplos de Componentes Lit

### vc-message-user

```typescript
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import type { UserMessage } from '../types.js'

@customElement('vc-message-user')
export class VcMessageUser extends LitElement {
  static styles = css`
    :host { display: block; padding: 8px 16px; }
    .message { display: flex; gap: 8px; }
    .avatar { width: 24px; height: 24px; border-radius: 50%; background: #4f46e5; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 12px; flex-shrink: 0; }
    .content { flex: 1; }
    .content p { margin: 4px 0; line-height: 1.5; }
    .timestamp { font-size: 11px; color: #888; }
    .image { max-width: 300px; border-radius: 8px; }
    @media (prefers-color-scheme: dark) {
      .avatar { background: #818cf8; }
    }
  `

  @property({ type: Object }) message!: UserMessage
  @property({ type: Boolean }) isLast = false

  render() {
    const { content, timestamp } = this.message
    return html`
      <div class="message">
        <div class="avatar">U</div>
        <div class="content">
          ${content.map((block) => {
            if (block.type === 'text') {
              return html`<vc-markdown .content=${block.text}></vc-markdown>`
            }
            if (block.type === 'image') {
              return html`<img class="image" src=${block.source} alt="user image" />`
            }
            return ''
          })}
          <div class="timestamp">${this.formatTime(timestamp)}</div>
        </div>
      </div>
    `
  }

  private formatTime(ts?: number): string {
    if (!ts) return ''
    return new Date(ts).toLocaleTimeString()
  }
}
```

### vc-message-list (com virtual scroll)

```typescript
import { LitElement, html, css } from 'lit'
import { customElement, property } from 'lit/decorators.js'
import { repeat } from 'lit/directives/repeat.js'
import type { Message } from '../types.js'

@customElement('vc-message-list')
export class VcMessageList extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; overflow-y: auto; flex: 1; padding-bottom: 16px; }
  `

  @property({ type: Array }) messages: Message[] = []
  @property({ type: Boolean }) verbose = false

  render() {
    return html`
      ${repeat(
        this.messages,
        (m: Message) => m.id,
        (m: Message) => html`
          <vc-message .message=${m} .verbose=${this.verbose}></vc-message>
        `
      )}
    `
  }
}
```

### vc-prompt-input

```typescript
import { LitElement, html, css } from 'lit'
import { customElement, property, state } from 'lit/decorators.js'
import { classMap } from 'lit/directives/class-map.js'
import { when } from 'lit/directives/when.js'
import type { Command, Agent } from '../types.js'

@customElement('vc-prompt-input')
export class VcPromptInput extends LitElement {
  static styles = css`
    :host { display: flex; flex-direction: column; border-top: 1px solid #333; background: #1a1a1a; padding: 8px 16px; }
    .input-row { display: flex; gap: 8px; align-items: center; }
    .input-area { flex: 1; min-height: 40px; max-height: 200px; }
    .mode-badge { font-size: 11px; color: #888; padding: 2px 8px; border: 1px solid #444; border-radius: 4px; }
    .mode-badge.bash { color: #22c55e; border-color: #22c55e; }
    .submit-btn { background: #4f46e5; color: #fff; border: none; border-radius: 6px; padding: 8px 16px; cursor: pointer; }
    .submit-btn:disabled { opacity: .4; cursor: not-allowed; }
    .suggestions { position: absolute; bottom: 100%; left: 16px; background: #222; border: 1px solid #444; border-radius: 8px; max-height: 200px; overflow-y: auto; }
    @media (prefers-color-scheme: light) {
      :host { background: #f5f5f5; border-color: #ddd; }
      .suggestions { background: #fff; border-color: #ddd; }
    }
  `

  @property({ type: Array }) commands: Command[] = []
  @property({ type: Array }) agents: Agent[] = []
  @property() mode: 'prompt' | 'bash' = 'prompt'
  @property({ type: Boolean }) disabled = false
  @state() private value = ''
  @state() private showCommands = false

  private onInput(e: InputEvent) {
    const el = e.target as HTMLTextAreaElement
    this.value = el.value
    this.showCommands = this.value.startsWith('/')
  }

  private onSubmit() {
    if (!this.value.trim() || this.disabled) return
    this.dispatchEvent(new CustomEvent('submit', {
      detail: { message: this.value },
      bubbles: true,
      composed: true,
    }))
    this.value = ''
    this.showCommands = false
  }

  private onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      this.onSubmit()
    }
  }

  render() {
    return html`
      <div class="input-row">
        <span class="mode-badge ${classMap({ bash: this.mode === 'bash' })}">
          ${this.mode === 'bash' ? '!' : '>'}
        </span>
        <textarea
          class="input-area"
          .value=${this.value}
          @input=${this.onInput}
          @keydown=${this.onKeyDown}
          ?disabled=${this.disabled}
          placeholder="Type a message... (/: commands, !: bash, @: files)"
          rows="1"
        ></textarea>
        <button class="submit-btn" ?disabled=${this.disabled || !this.value.trim()} @click=${this.onSubmit}>
          →
        </button>
      </div>

      ${when(this.showCommands, () => html`
        <div class="suggestions">
          ${this.commands
            .filter((c) => c.name.startsWith(this.value.slice(1)))
            .slice(0, 8)
            .map((c) => html`<div @click=${() => this.selectCommand(c)}>/${c.name}</div>`)}
        </div>
      `)}
    `
  }
}
```

## Build e Deploy

```bash
# package.json
{
  "name": "verboo-lit-frontend",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "lit": "^3.2.0",
    "marked": "^15.0.0",
    "dompurify": "^3.2.0"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "vite": "^6.0.0",
    "lit-css-loader": "^1.0.0"
  }
}
```

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8765',
      '/ws': {
        target: 'ws://localhost:8765',
        ws: true,
      },
    },
  },
})
```

## Integração com Daemon

O frontend Lit se conecta ao **Verboo Daemon** rodando localmente:

```typescript
// src/api/client.ts
export class DaemonClient {
  private baseUrl: string
  private ws: WebSocket | null = null
  private sessionId: string | null = null

  constructor(baseUrl = 'http://localhost:8765') {
    this.baseUrl = baseUrl
  }

  async createSession(model = 'sonnet'): Promise<string> {
    const res = await fetch(`${this.baseUrl}/api/v1/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model }),
    })
    const data = await res.json()
    this.sessionId = data.session.id
    return this.sessionId
  }

  connectWebSocket(
    onEvent: (event: StreamEvent) => void,
    onError: (err: string) => void,
    onStateChange: (state: string) => void,
  ): WebSocket {
    const ws = new WebSocket(`${this.wsUrl}/api/v1/ws?session_id=${this.sessionId}`)

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data)
      switch (data.type) {
        case 'stream_event':
          onEvent(data.event)
          break
        case 'session_state':
          onStateChange(data.state)
          break
        case 'error':
          onError(data.error)
          break
      }
    }

    ws.onclose = () => setTimeout(() => this.connectWebSocket(onEvent, onError, onStateChange), 1000)
    this.ws = ws
    return ws
  }

  async sendMessage(message: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/sessions/${this.sessionId}/input`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  async getHistory(): Promise<Message[]> {
    const res = await fetch(
      `${this.baseUrl}/api/v1/sessions/${this.sessionId}/messages`,
    )
    const data = await res.json()
    return data.messages
  }

  async executeCommand(command: string): Promise<void> {
    // Via SSE endpoint
    const res = await fetch(
      `${this.baseUrl}/api/v1/sessions/${this.sessionId}/command`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command }),
      },
    )
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
  }

  disconnect(): void {
    this.ws?.close()
  }
}
```

## Temas

Suporte a tema claro e escuro seguindo `prefers-color-scheme`:

```typescript
// Tema claro (padrão)
:host {
  --bg-primary: #ffffff;
  --bg-secondary: #f5f5f5;
  --bg-tertiary: #e5e5e5;
  --text-primary: #1a1a1a;
  --text-secondary: #666;
  --border: #ddd;
  --accent: #4f46e5;
  --accent-light: #eef2ff;
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
}

// Tema escuro
@media (prefers-color-scheme: dark) {
  :host {
    --bg-primary: #1a1a1a;
    --bg-secondary: #222;
    --bg-tertiary: #333;
    --text-primary: #e5e5e5;
    --text-secondary: #888;
    --border: #444;
    --accent: #818cf8;
    --accent-light: #1e1b4b;
    --success: #22c55e;
    --warning: #f59e0b;
    --error: #ef4444;
  }
}
```

---

*Plano gerado em 20/07/2026*
