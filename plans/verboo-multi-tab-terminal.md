# Verboo Multi-Tab Terminal — Plano Arquitetural

## Visão Geral

O Verboo Web funciona como **Windows Terminal**: múltiplas abas, cada uma um terminal Verboo independente, podendo ser:

1. **Spawnada** (nova sessão com cwd customizável)
2. **Absorvida** (anexada a um processo Verboo já rodando na máquina)
3. **Renomeada**, **fechada**, **destacada**

## Arquitetura

### Camadas

```
┌──────────────────────────────────────────────────┐
│            Frontend Lit (Browser)                │
│  ┌────────────────────────────────────────────┐  │
│  │ vc-tabs-bar                                │  │
│  │ ┌──────┐ ┌──────┐ ┌──────┐ ┌───┐ ┌─────┐  │  │
│  │ │tab 1 │ │tab 2 │ │tab 3 │ │ + │ │new  │  │  │
│  │ │main  │ │feat  │ │debug │ │   │ │tab  │  │  │
│  │ └──────┘ └──────┘ └──────┘ └───┘ └─────┘  │  │
│  └────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────┐  │
│  │ vc-tab-content (ativo)                     │  │
│  │   vc-message-list para sessão atual        │  │
│  │   vc-prompt-input para sessão atual        │  │
│  └────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────┘
         │                    │
         │ HTTP REST          │ WebSocket (um por sessão)
         ▼                    ▼
┌──────────────────────────────────────────────────┐
│              Verboo Daemon                        │
│                                                   │
│  ┌─────────────────────────────────────────────┐ │
│  │ SessionManager (multi-session)              │ │
│  │  ├─ Session(id, type, source, pty?, sdk?)   │ │
│  │  ├─ SessionStore (persistente)              │ │
│  │  └─ ProcessDetector                          │ │
│  │       ├─ scanVerbooProcesses()              │ │
│  │       └─ attachToProcess(pid)               │ │
│  ├─────────────────────────────────────────────┤ │
│  │ Runtimes                                     │ │
│  │  ├─ VerbooRuntime (SDK virtual sessions)    │ │
│  │  ├─ PTYRuntime (terminais reais node-pty)   │ │
│  │  └─ AttachRuntime (attach a processo)       │ │
│  └─────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

### Tipos de Sessão

```typescript
type SessionType =
  | 'sdk'      // Sessão SDK virtual (atual VerbooRuntime)
  | 'pty'      // PTY real com Verboo CLI spawned
  | 'attach'   // Anexado a processo Verboo já rodando

interface TabSession {
  id: string
  type: SessionType
  title: string
  pid?: number
  cwd: string
  model?: string
  createdAt: number
  lastActivity: number
  // PTY-specific
  ptyProcess?: import('node-pty').IPty
  // SDK-specific
  sdkSession?: unknown
  // Attach-specific
  attachedTo?: number  // original PID
}
```

## Backend — Endpoints

### Listar todas as sessões (ativas + absorvíveis)

```
GET /api/v1/tabs
→ 200 {
  active: TabSession[],     // gerenciadas pelo daemon
  available: AvailableProcess[]  // processos Verboo soltos na máquina
}

AvailableProcess {
  pid: number
  sessionId: string
  cwd: string
  model: string
  startedAt: number
  attachable: boolean
}
```

### Detectar processos Verboo locais

```
GET /api/v1/processes
→ 200 { processes: AvailableProcess[] }
```

O daemon usa `ps aux | grep verboo` ou lê `/proc/*/cmdline` no Linux, `wmic` no Windows. Filtra processos Verboo (não o próprio daemon).

### Spawnar novo PTY

```
POST /api/v1/tabs/spawn
Body: {
  cwd: string,           // path obrigatório
  model?: string,        // default: sonnet
  title?: string,
  runtime?: 'verboo'     // qual CLI spawnar
}
→ 201 { tab: TabSession }

Daemon:
1. Valida cwd (existe, é diretório)
2. node-pty.spawn('verboo', [], { cwd, ... })
3. Registra no SessionManager
4. Retorna tab
```

### Attachar a processo existente

```
POST /api/v1/tabs/attach
Body: { pid: number }
→ 201 { tab: TabSession }

Daemon:
1. Valida PID existe e é processo Verboo
2. Abre socket IPC para o processo ( Unix Domain Socket ~/.verboo/daemon/ipc/<pid>.sock )
3. Registra como AttachSession
4. Proxy de input/output entre socket e WebSocket

OU alternativa simples:
1. Envia SIGUSR1 para o PID
2. O processo Verboo responde conectando ao daemon via WS
3. Daemon troca o stdout/stderr do processo
```

### Operações de tab

```
POST /api/v1/tabs                  // criar via SDK (atual)
POST /api/v1/tabs/spawn            // criar via PTY
POST /api/v1/tabs/attach           // absorver processo
GET  /api/v1/tabs/:id              // detalhes
PATCH /api/v1/tabs/:id             // renomear
DELETE /api/v1/tabs/:id            // fechar (matar processo se PTY)
POST /api/v1/tabs/:id/detach       // desanexar mantendo processo vivo
```

### File system para path picker

```
GET /api/v1/fs/list?path=/home/user
→ 200 {
  path: string,
  parent: string,
  entries: [
    { name: 'project1', type: 'dir', isGit: true },
    { name: 'file.txt', type: 'file' },
    ...
  ]
}

GET /api/v1/fs/home
→ 200 { path: '/home/alvaro' }

GET /api/v1/fs/recent
→ 200 { paths: string[] }  // últimos cwd usados
```

### WebSocket por sessão (multiplexado)

```
ws://localhost:8765/api/v1/ws?tab_id=<id>

Mensagens servidor → cliente:
{ type: 'tab.output', tabId, data: string }       // pty output
{ type: 'tab.stream_event', tabId, event }         // sdk event
{ type: 'tab.state', tabId, state }
{ type: 'tab.closed', tabId, reason }

Mensagens cliente → servidor:
{ type: 'tab.input', tabId, data: string }
{ type: 'tab.interrupt', tabId }
{ type: 'tab.resize', tabId, cols: number, rows: number }
```

## Detecção de Processos Verboo

### Estratégia (cross-platform)

```typescript
// src/daemon/core/process/ProcessDetector.ts
import { exec } from 'node:child_process'

export class ProcessDetector {
  async listVerbooProcesses(): Promise<AvailableProcess[]> {
    if (process.platform === 'win32') {
      return this.listWindows()
    }
    return this.listUnix()
  }

  private async listUnix(): Promise<AvailableProcess[]> {
    // Linux/macOS: lê /proc ou usa ps
    return new Promise((resolve) => {
      exec('ps aux | grep -E "verboo|claude" | grep -v grep', (err, stdout) => {
        if (err) return resolve([])
        const lines = stdout.trim().split('\n')
        const procs = lines
          .map((line) => this.parsePsLine(line))
          .filter((p): p is AvailableProcess => p !== null)
        resolve(procs)
      })
    })
  }

  private async listWindows(): Promise<AvailableProcess[]> {
    return new Promise((resolve) => {
      exec('wmic process where "name=\'verboo.exe\'" get ProcessId,CommandLine', (err, stdout) => {
        if (err) return resolve([])
        const lines = stdout.trim().split('\n').slice(1)
        const procs = lines
          .map((line) => this.parseWmicLine(line))
          .filter((p): p is AvailableProcess => p !== null)
        resolve(procs)
      })
    })
  }
}
```

### IPC para attach

Cada processo Verboo registra um **Unix Domain Socket** ao iniciar:

```
~/.verboo/daemon/ipc/<pid>.sock
```

Quando o daemon quer attachar:

1. Conecta ao socket
2. Envia `{ type: 'attach_request', daemonPid }`
3. O processo Verboo responde com `{ type: 'attach_accepted' }` e começa a enviar stdout/stderr pelo socket
4. Daemon proxy entre socket e WebSocket do frontend

Isso requer modificação mínima no CLI do Verboo (adicionar IPC server), mas como filosofia é "zero forks", alternativa é:

- Daemon lê `/proc/<pid>/fd/1` (somente leitura, sem input)
- Para input: precisa do IPC handshake

## Frontend — UI de Abas

### vc-tabs-bar

```
┌─────────────────────────────────────────────────────────────┐
│ [●main ·] [feat/auth ·] [✗debug ·] [+] [▼]                  │
└─────────────────────────────────────────────────────────────┘
```

- Cada aba mostra: ícone de status (●running/○idle/✗error), título, botão fechar
- Clique seleciona aba ativa
- `[+]` abre dialog New Tab
- `[▼]` menu: listar abas absorvíveis, renomear, destacar

### Dialog New Tab

```
┌─────────────────────────────────────────────────────────────┐
│ New Tab                                              [X]    │
├─────────────────────────────────────────────────────────────┤
│ Type: (•) Spawn new  ( ) Attach existing  ( ) SDK virtual   │
│                                                             │
│ ── If Spawn ──                                              │
│ Working directory:                                          │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ /home/alvaro/projects/                                   │ │
│ │ 📁 project1                                              │ │
│ │ 📁 project2 (git)                                        │ │
│ │ 📁 verboo-code (git)                                     │ │
│ └─────────────────────────────────────────────────────────┘ │
│ Recent: [verboo-code] [project1] [tmp]                      │
│                                                             │
│ Model: [sonnet ▼]                                           │
│ Title: [_________________________________________]          │
│                                                             │
│ ── If Attach ──                                             │
│ Available processes:                                        │
│   ◯ PID 12345 · main · /home/alvaro/project1               │
│   ◯ PID 12346 · debug · /home/alvaro/tmp                    │
│                                                             │
│                          [Cancel]  [Create]                 │
└─────────────────────────────────────────────────────────────┘
```

### State por aba

```typescript
// src/state/tab-store.ts
class TabStore {
  private tabs = new Map<string, TabState>()
  private activeTabId: string | null = null

  interface TabState {
    id: string
    title: string
    messages: Message[]
    streamingText: string
    streamingThinking: string
    isProcessing: boolean
    cwd: string
    model: string
    type: 'sdk' | 'pty' | 'attach'
  }

  getActive(): TabState | null
  switchTo(tabId: string): void
  open(tab: TabSession): void
  close(tabId: string): void
  appendMessage(tabId: string, msg: Message): void
}
```

Cada aba tem seu próprio:
- message-store
- WebSocket
- input history
- scroll position

## Roadmap de Implementação

### Sprint A — Backend PTY + Detecção (1-2 dias)

1. `npm install node-pty` no daemon
2. `PTYRuntime.ts` — implementa IRuntime usando node-pty
3. `ProcessDetector.ts` — lista processos Verboo locais
4. Rotas: `/processes`, `/tabs/spawn`, `/tabs/attach`
5. WebSocket multiplexado com `tab_id`

### Sprint B — Frontend Tabs (2-3 dias)

1. `vc-tabs-bar.ts` — barra de abas
2. `vc-tab-content.ts` — container que mostra a aba ativa
3. `vc-dialog-new-tab.ts` — dialog com 3 modos (spawn/attach/sdk)
4. `vc-path-picker.ts` — browser de diretórios
5. `tab-store.ts` — state por aba
6. WebSocket manager com `tab_id` routing

### Sprint C — IPC para Attach (3-5 dias)

1. Hook no CLI do Verboo: ao iniciar, cria socket em `~/.verboo/daemon/ipc/<pid>.sock`
2. Daemon conecta ao socket para attach
3. Proxy bidirecional de input/output

**Alternativa sem hook no CLI**: attach somente leitura via `/proc/<pid>/fd/1` + notificação via arquivo de estado

## Considerações

### Complexidade vs Valor

- **PTY spawn**: baixa complexidade, alto valor (qualquer novo terminal escolhe path)
- **Absorver processo**: alta complexidade (precisa IPC ou hook no CLI), valor médio (no início, poucos terminais Verboo soltos)
- **Multi-tab UI**: média complexidade, alto valor (UX principal)

### Risco de fork

PTY spawn não precisa de mudanças no CLI do Verboo — apenas `spawn('verboo', args, { cwd })`. Attach sim precisaria. Solução híbrida:

- **MVP**: spawn + SDK virtual + multi-tab UI
- **V2**: attach via IPC (precisa de contribuição upstream)

### Performance

- Cada PTY = 1 processo filho (caro)
- Limitar a 8 abas por padrão (configurável)
- Lazy load: abas em background não renderizam mensagens

---

*Plano gerado em 21/07/2026*
