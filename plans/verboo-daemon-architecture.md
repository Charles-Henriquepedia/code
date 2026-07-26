# Verboo Daemon API — Plano Arquitetural

## Estado Atual (Análise Etapas 1-2)

### Arquitetura Atual (Monolítica no CLI)

```
bin/verboo
  → src/entrypoints/cli.tsx (fast-path dispatcher)
    → src/main.tsx::main() → run() → action() handler (~3500 linhas)
      → setup: configs, mTLS, proxies, MCP, plugins
      → session: fresh ou resume (conversationRecovery.ts)
      → REPL: launchRepl() → <App><REPL /></App>
      → query: queryLoop() (streaming, tools, compact, continuation)
      → headless: runHeadless() → StructuredIO → NDJSON stdout
```

### Subsistemas Mapeados

| Subsistema | Arquivos | Estado |
|---|---|---|
| Session Lifecycle | `src/main.tsx`, `src/utils/sessionStorage.ts`, `src/bootstrap/state.ts` | Monolítico, mas storage é reutilizável |
| Query Loop | `src/query.ts` (1996 linhas), `src/QueryEngine.ts` | Reutilizável via SDK |
| Command Registry | `src/commands.ts` (788 linhas) | Auto-descoberta via imports |
| Tool Registry | `src/tools.ts`, `src/Tool.ts` | Auto-descoberta via imports |
| SDK Entrypoint | `src/entrypoints/sdk/` (v2.ts, query.ts, sessions.ts) | **Reutilizável diretamente** |
| StructuredIO | `src/cli/structuredIO.ts` (860 linhas) | Reutilizável |
| Transports | `src/cli/transports/WebSocketTransport.ts`, `SSETransport.ts`, `HybridTransport.ts` | Reutilizáveis |
| Bridge System | `src/bridge/` (34 arquivos) | Inspiração arquitetural |
| Session State | `src/utils/sessionState.ts` | Reutilizável |
| Config | `src/utils/config.ts`, `src/utils/settings/` | Reutilizável |
| Model/Provider | `src/services/api/claude.ts`, `src/utils/model/` | Reutilizável |
| Skills | `src/commands.ts` (getSkillToolCommands) | Reutilizável via registry |
| Tools | `src/tools/` (40+ tools) | Reutilizáveis |

### Descobertas Críticas

1. **NÃO existe daemon** — tudo roda no processo do CLI
2. **NÃO existe servidor HTTP** — monitor server foi removido
3. **NÃO existe web UI** — tudo é terminal (Ink/React)
4. **SDK entrypoint existe** — `sdk.d.ts` e `src/entrypoints/sdk/` já expõem API programática
5. **Bridge system existe** — faz polling de work items, spawna child processes, gerencia sessões remotas
6. **StructuredIO** — protocolo NDJSON maduro, usado pelo SDK e bridge
7. **Transports** — WebSocket, SSE e Hybrid já implementados com reconexão, backoff, buffering
8. **AsyncLocalStorage** — já usado para isolamento de contexto SDK

---

## Oportunidades de Reutilização (Etapa 3)

### Pode Reutilizar Diretamente (sem modificar)

| Módulo | Caminho | Como Reutilizar |
|---|---|---|
| QueryEngine | `src/QueryEngine.ts` | Importar e instanciar para cada sessão |
| Query Loop | `src/query.ts` | `query()` retorna AsyncGenerator |
| StructuredIO | `src/cli/structuredIO.ts` | NDJSON protocol para streaming |
| WebSocketTransport | `src/cli/transports/WebSocketTransport.ts` | Transporte bidirecional |
| SSETransport | `src/cli/transports/SSETransport.ts` | Transporte server→client |
| Session Storage | `src/utils/sessionStorage.ts` | `recordTranscript()`, `loadTranscriptFromFile()` |
| Session State | `src/utils/sessionState.ts` | `notifySessionStateChanged()` |
| Command Registry | `src/commands.ts` | `getCommands()`, `findCommand(), `getCommand()` |
| Tool Registry | `src/tools.ts` | `getAllBaseTools()`, `getTools()` |
| SDK Entrypoint | `src/entrypoints/sdk/v2.ts` | `unstable_v2_createSession()`, `unstable_v2_resumeSession()` |
| State Bootstrap | `src/bootstrap/state.ts` | `runWithSdkContext()`, `switchSession()` |
| Config | `src/utils/config.ts` | `getConfig()`, `getSetting()` |
| Providers | `src/services/api/claude.ts` | API calls para modelos |
| Bridge Messaging | `src/bridge/bridgeMessaging.ts` | `handleIngressMessage()`, `BoundedUUIDSet` |

### Precisa Adaptar/Criar Wrapper

| Módulo | Caminho | Adaptação Necessária |
|---|---|---|
| Session Creation | `src/main.tsx` action() | Extrair lógica de criação de sessão do handler monolítico |
| Headless Mode | `src/cli/print.ts` | `runHeadless()` → adaptar para output via WebSocket |
| Session Resume | `src/utils/conversationRecovery.ts` | `loadConversationForResume()` → expor como serviço |
| Session Runner | `src/bridge/sessionRunner.ts` | `createSessionSpawner()` → adaptar para daemon |
| AppState Store | `src/state/AppStateStore.ts` | Criar instâncias isoladas por sessão |

### Precisa Construir do Zero

| Componente | Justificativa |
|---|---|
| HTTP API Server | Express/Fastify router — não existe no código |
| WebSocket Server | Server-side WS (existe só client-side) |
| Daemon Process Manager | Gerenciamento de ciclo de vida do daemon |
| Session Manager | Multi-session: criar, destruir, listar, monitorar |
| IRuntime Interface | Abstração genérica para múltiplos CLIs |
| Event Bus | Pub/sub para eventos internos |
| Auth Middleware | Preparação para autenticação futura |
| Auto-Discovery System | Convention over Configuration |
| Documentation Generator | Metadados de comandos → docs |

---

## Proposta de Arquitetura (Etapa 4)

### Princípios

1. **Zero forks** — nunca modificar código do upstream; apenas importar
2. **Camadas estritas** — Core → CLI/Daemon → API → Transport
3. **Adapters** — API nunca conhece CLI; conversa com RuntimeAdapter
4. **Registry Pattern** — comandos, skills, tools auto-descobertos
5. **Event-Driven** — tudo publicado como eventos
6. **SDK-first** — reutilizar `src/entrypoints/sdk/` como foundation
7. **Files pequenos** — 150–250 linhas, máx 300

### Estrutura de Diretórios

```
verboo-daemon/
├── src/
│   ├── core/                    # Lógica de negócio (sem dep CLI/HTTP)
│   │   ├── runtime/
│   │   │   ├── IRuntime.ts          # Interface genérica do runtime
│   │   │   ├── VerbooRuntime.ts     # Adaptador Verboo
│   │   │   └── RuntimeRegistry.ts   # Auto-descoberta de runtimes
│   │   ├── session/
│   │   │   ├── Session.ts           # Modelo de sessão
│   │   │   ├── SessionManager.ts    # Gerenciamento multi-sessão
│   │   │   └── SessionStore.ts      # Persistência (reusa sessionStorage)
│   │   ├── command/
│   │   │   ├── Command.ts           # Interface Command
│   │   │   ├── CommandRegistry.ts   # Registry (reusa commands.ts)
│   │   │   └── CommandExecutor.ts   # Execução de comandos
│   │   ├── tool/
│   │   │   ├── Tool.ts              # Interface Tool
│   │   │   └── ToolRegistry.ts      # Registry (reusa tools.ts)
│   │   ├── skill/
│   │   │   └── SkillRegistry.ts     # Registry (reusa skills)
│   │   ├── model/
│   │   │   ├── ModelManager.ts      # Gerenciamento de modelos
│   │   │   └── ProviderAdapter.ts   # Adaptador de providers
│   │   ├── event/
│   │   │   ├── EventBus.ts          # Pub/sub interno
│   │   │   └── EventTypes.ts        # Tipos de eventos
│   │   ├── workspace/
│   │   │   └── WorkspaceManager.ts  # Gerenciamento de workspaces
│   │   └── config/
│   │       └── ConfigService.ts     # Serviço de configuração
│   │
│   ├── adapter/                 # Camada de adaptação
│   │   ├── RuntimeAdapter.ts        # Interface entre API e Runtime
│   │   ├── SessionToRuntime.ts      # Mapeamento sessão→runtime
│   │   └── OutputAdapter.ts         # Adaptação de output
│   │
│   ├── api/                     # API HTTP + WebSocket
│   │   ├── server/
│   │   │   ├── HttpServer.ts        # Servidor HTTP
│   │   │   ├── WsServer.ts          # Servidor WebSocket
│   │   │   └── ServerConfig.ts      # Configuração do servidor
│   │   ├── routes/
│   │   │   ├── sessions.ts          # CRUD de sessões
│   │   │   ├── commands.ts          # Listar/executar comandos
│   │   │   ├── models.ts            # Listar modelos
│   │   │   ├── skills.ts            # Listar skills
│   │   │   ├── tools.ts             # Listar tools
│   │   │   ├── config.ts            # Configuração
│   │   │   └── health.ts            # Health check
│   │   ├── middleware/
│   │   │   ├── auth.ts              # Autenticação (preparação)
│   │   │   ├── cors.ts              # CORS
│   │   │   └── rateLimit.ts         # Rate limiting
│   │   └── schemas/
│   │       ├── SessionSchema.ts     # Schemas Zod
│   │       ├── MessageSchema.ts
│   │       ├── CommandSchema.ts
│   │       └── EventSchema.ts
│   │
│   ├── daemon/                  # Gerenciamento do daemon
│   │   ├── Daemon.ts               # Ciclo de vida do daemon
│   │   ├── DaemonConfig.ts          # Configuração
│   │   └── PidFile.ts               # Gerenciamento PID
│   │
│   ├── cli/                     # CLI (wrapper leve)
│   │   ├── index.ts                 # Entry point
│   │   ├── commands.ts              # Comandos CLI
│   │   └── output.ts               # Formatação terminal
│   │
│   └── types/                   # Tipos compartilhados
│       ├── session.ts
│       ├── runtime.ts
│       ├── events.ts
│       └── api.ts
```

### Arquitetura em Camadas

```
┌─────────────────────────────────────────────┐
│                 Clientes                     │
│  QDA IDE | Electron | Browser | VSCode      │
└──────────────────┬──────────────────────────┘
                   │ HTTP REST + WebSocket
┌──────────────────▼──────────────────────────┐
│           API Layer (api/)                    │
│  HttpServer | WsServer | Routes | Middleware │
└──────────────────┬──────────────────────────┘
                   │ RuntimeAdapter interface
┌──────────────────▼──────────────────────────┐
│         Adapter Layer (adapter/)              │
│  RuntimeAdapter → SessionToRuntime           │
└──────────────────┬──────────────────────────┘
                   │ Chama core/ via IRuntime
┌──────────────────▼──────────────────────────┐
│          Core Layer (core/)                   │
│  SessionManager | CommandRegistry | ToolReg  │
│  EventBus | ConfigService | ModelManager     │
└──────────────────┬──────────────────────────┘
                   │ Reusa código do Verboo CLI
┌──────────────────▼──────────────────────────┐
│     Verboo Runtime (runtime/verboo/)          │
│  Importa src/entrypoints/sdk/                │
│  Importa src/query.ts, src/QueryEngine.ts     │
│  Importa src/utils/sessionStorage.ts          │
│  Importa src/commands.ts, src/tools.ts        │
└─────────────────────────────────────────────┘
```

### IRuntime Interface

```typescript
interface IRuntime {
  readonly id: string
  readonly name: string

  // Ciclo de vida
  initialize(config: RuntimeConfig): Promise<void>
  shutdown(): Promise<void>

  // Sessões
  createSession(options: SessionOptions): Promise<Session>
  resumeSession(sessionId: string): Promise<Session>
  destroySession(sessionId: string): Promise<void>
  listSessions(): Promise<SessionSummary[]>

  // Execução
  submitMessage(sessionId: string, message: string): AsyncGenerator<StreamEvent>
  interruptSession(sessionId: string): Promise<void>

  // Comandos (delega para CommandRegistry)
  getCommands(): Command[]
  executeCommand(sessionId: string, command: string): Promise<void>

  // Tools
  getTools(): Tool[]

  // Skills
  getSkills(): Skill[]

  // Modelos
  getModels(): ModelInfo[]
  setModel(sessionId: string, modelId: string): Promise<void>

  // Eventos
  on(event: string, listener: Function): void
  off(event: string, listener: Function): void
}
```

### Event Bus

```typescript
// Eventos do sistema
type SystemEvent =
  | { type: 'session.created'; sessionId: string; timestamp: number }
  | { type: 'session.destroyed'; sessionId: string; reason: string }
  | { type: 'session.started'; sessionId: string; model: string }
  | { type: 'session.stopped'; sessionId: string; reason: string }
  | { type: 'session.error'; sessionId: string; error: Error }
  | { type: 'session.state_changed'; sessionId: string; state: SessionState }
  | { type: 'session.output'; sessionId: string; message: StreamEvent }
  | { type: 'model.changed'; sessionId: string; model: string }
  | { type: 'command.executed'; sessionId: string; command: string; args: string[] }
  | { type: 'skill.executed'; sessionId: string; skill: string }
  | { type: 'tool.called'; sessionId: string; tool: string; input: unknown }
  | { type: 'daemon.starting'; pid: number }
  | { type: 'daemon.started'; pid: number; port: number }
  | { type: 'daemon.stopping'; reason: string }
  | { type: 'daemon.stopped'; exitCode: number }

// Interface do EventBus
interface EventBus {
  emit(event: SystemEvent): void
  on<T extends SystemEvent['type']>(
    type: T,
    handler: (event: Extract<SystemEvent, { type: T }>) => void
  ): () => void  // unsubscribe
  once<T extends SystemEvent['type']>(
    type: T,
    handler: (event: Extract<SystemEvent, { type: T }>) => void
  ): void
  off(type: string, handler: Function): void
}
```

---

## Contratos da API (Etapa 6)

### REST API

#### Sessions

```
GET  /api/v1/sessions
     → 200 { sessions: SessionSummary[] }

POST /api/v1/sessions
     Body: { workspace?: string, model?: string, title?: string }
     → 201 { session: Session }

GET  /api/v1/sessions/:id
     → 200 { session: SessionDetail }
     → 404 { error: "session not found" }

DELETE /api/v1/sessions/:id
     → 204

POST /api/v1/sessions/:id/input
     Body: { message: string }
     → 202 { accepted: true }
     (Response streamed via WebSocket)

POST /api/v1/sessions/:id/interrupt
     → 200 { interrupted: true }

POST /api/v1/sessions/:id/model
     Body: { model: string }
     → 200 { model: string }
```

#### Commands

```
GET /api/v1/commands
     → 200 { commands: CommandInfo[] }

POST /api/v1/sessions/:id/commands
     Body: { command: string, args?: string[] }
     → 202 { accepted: true }
```

#### Models

```
GET /api/v1/models
     → 200 { models: ModelInfo[] }
```

#### Skills

```
GET /api/v1/skills
     → 200 { skills: SkillInfo[] }
```

#### Tools

```
GET /api/v1/tools
     → 200 { tools: ToolInfo[] }
```

#### Health & Info

```
GET /api/v1/health
     → 200 { status: "ok", uptime: number, sessions: number, version: string }

GET /api/v1/info
     → 200 { version: string, runtimes: string[], uptime: number }
```

### WebSocket API

```
Endpoint: ws://host:port/api/v1/ws?session_id=<id>&token=<auth>

Mensagens do Servidor (JSON):
  { type: 'stream_event', sessionId, event: StreamEvent }
  { type: 'session_state', sessionId, state: 'idle'|'running'|'requires_action' }
  { type: 'session_output', sessionId, content: string }
  { type: 'error', sessionId, error: string }
  { type: 'system', subtype: 'status', ... }
  { type: 'keep_alive' }

Mensagens do Cliente:
  { type: 'input', message: string }
  { type: 'command', command: string, args?: string[] }
  { type: 'interrupt' }
  { type: 'keep_alive' }
```

### Schemas Principais

```typescript
// Session
interface Session {
  id: string
  pid: number
  state: 'idle' | 'running' | 'requires_action' | 'error'
  runtimeId: string
  model: string
  workspace: string
  cwd: string
  createdAt: string
  updatedAt: string
  title?: string
  config: Record<string, unknown>
}

interface SessionSummary {
  id: string
  state: string
  model: string
  title?: string
  createdAt: string
  runtimeId: string
}

interface SessionDetail extends Session {
  messages: number
  costUSD: number
  duration: number
}

// Command
interface CommandInfo {
  name: string
  description: string
  aliases: string[]
  type: 'prompt' | 'local' | 'local-jsx'
  argumentHint?: string
  source: string
  hidden: boolean
  enabled: boolean
}

// Model
interface ModelInfo {
  id: string
  name: string
  provider: string
  capabilities: string[]
  contextWindow: number
  supportsThinking: boolean
}

// Skill
interface SkillInfo {
  name: string
  description: string
  source: string
  arguments?: string[]
  examples?: string[]
}

// Tool
interface ToolInfo {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  isReadOnly: boolean
  isConcurrencySafe: boolean
}

// Event - StreamEvent (reusa de query.ts)
type StreamEvent =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: unknown }
  | { type: 'tool_result'; tool_use_id: string; content: unknown }
  | { type: 'thinking'; thinking: string }
  | { type: 'content_block_start'; index: number; content_block: unknown }
  | { type: 'content_block_delta'; index: number; delta: unknown }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_start'; message: unknown }
  | { type: 'message_delta'; delta: unknown }
  | { type: 'message_stop' }
  | { type: 'error'; error: string }
```

---

## Roadmap Incremental (Etapa 5)

### Fase 1: Foundation (semanas 1-2)

**Objetivo:** Setup do projeto, interfaces core, runtime adapter

1. Criar estrutura de diretórios
2. Configurar build (Bun, TypeScript)
3. Implementar `EventBus`
4. Implementar `IRuntime` interface
5. Implementar `CommandRegistry` (wrapper sobre `src/commands.ts`)
6. Implementar `ToolRegistry` (wrapper sobre `src/tools.ts`)
7. Implementar `ConfigService`
8. Implementar `Session` model

### Fase 2: VerbooRuntime (semanas 3-4)

**Objetivo:** Adaptador Verboo funcional, reutilizando SDK

1. Implementar `VerbooRuntime` usando `src/entrypoints/sdk/v2.ts`
2. Implementar `SessionManager` (multi-session)
3. Wrapper sobre `StructuredIO` para streaming
4. Wrapper sobre `sessionStorage.ts` para persistência
5. Implementar `SessionStore`
6. Testar criação/resumo de sessões programaticamente

### Fase 3: HTTP API (semanas 5-6)

**Objetivo:** API REST funcional

1. Servidor HTTP (Fastify ou Express)
2. Rotas de sessões (CRUD)
3. Rotas de comandos, modelos, skills, tools
4. Schema validation (Zod)
5. Health check
6. CORS middleware
7. Tratamento de erros consistente

### Fase 4: WebSocket + Streaming (semanas 7-8)

**Objetivo:** Streaming em tempo real

1. Servidor WebSocket
2. Roteamento por session_id
3. Streaming de eventos (`query()` → WS)
4. Reuso de `WebSocketTransport` e `SSETransport`
5. Reconexão e keep-alive
6. Testes de integração

### Fase 5: Daemon (semanas 9-10)

**Objetivo:** Daemon mode funcional

1. `Daemon` class (ciclo de vida)
2. PID file management
3. Graceful shutdown
4. Signal handling (SIGINT, SIGTERM, SIGHUP)
5. Logging
6. CLI wrapper (`verboo daemon start|stop|status`)

### Fase 6: Auto-Discovery (semanas 11-12)

**Objetivo:** Convention over Configuration

1. Auto-descoberta de comandos no filesystem
2. Auto-descoberta de runtimes
3. Auto-descoberta de adapters
4. Geração automática de documentação
5. Geração automática de schemas da API

### Fase 7: CLI Integration (semana 13)

**Objetivo:** CLI como cliente do daemon

1. `verboo` CLI detecta daemon running
2. CLI redireciona comandos para daemon API
3. Fallback para modo standalone (sem daemon)
4. `--daemon` flag

### Fase 8: Segurança + Extras (semana 14+)

**Objetivo:** Preparação para produção

1. Auth middleware (token-based)
2. Rate limiting
3. TLS support
4. Multi-usuário (preparação arquitetural)
5. Outros runtimes (Claude Code, Codex, Aider)

---

## Considerações Finais

### Riscos Identificados

1. **Dependência do SDK interno** — `src/entrypoints/sdk/` pode mudar com updates
2. **Global state singleton** — `bootstrap/state.ts` é global, necessário `runWithSdkContext()`
3. **Monolítico main.tsx** — ação de 3500 linhas, extrair lógica é trabalhoso
4. **Ink/React** — terminal rendering não é reutilizável para web; web UI precisa ser separada
5. **Feature flags** — muitos recursos são feature-gated (MONITOR_TOOL, BRIDGE_MODE, etc.)
6. **Verboo-specific auth** — OAuth flow depende de Verboo platform

### Mitigações

1. **Versão fixa** do `@verboo/code` como dependência
2. **Adapters finos** — mínima superfície de contato com o core
3. **Testes de integração** contínuos contra o upstream
4. **TDD** — definir contratos antes de implementar

---

*Documento gerado em 20/07/2026 como parte do goal "Verboo Daemon API"*
