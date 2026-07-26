## Status — Monitor Web 100% Feature Parity

### ✅ Completo
- [x] WebSocket route fix: `/api/v1/ws` aceito além de `/ws`
- [x] Protocol translation: Lit frontend (`session_state`, `stream_event`, `transcript_append`) ↔ Monitor server (`update`, `terminal-stream`, `transcript-delta`)
- [x] PTY relay: `pty_create`, `pty_input`, `pty_resize`, `pty_kill` via WebSocket
- [x] PTY output streaming via `stream_event` messages
- [x] CORS fix: `Access-Control-Allow-Headers: Content-Type, Authorization`
- [x] API adapter: `/api/v1/sessions` retorna array `[{id, title, model, status}]`
- [x] POST `/api/v1/sessions` retorna `{session: {...}}`
- [x] Model info extraído do transcript
- [x] Token auth (UUID em `~/.verboo/monitor/server.token`)
- [x] xterm.js integration com CDN
- [x] Multi-session grid view
- [x] Activity feed SSE
- [x] Cost tracking (usage endpoint)
- [x] Inline JS validation no build

### 🔄 Em andamento
- [ ] UI polish (Windows Terminal style)
- [ ] xterm.js real PTY integration (node-pty compilation needed)

### Arquitetura final

```
Browser (Lit frontend / Monitor HTML)
    ↕ WebSocket (/api/v1/ws ou /ws)
Monitor Server (Node.js)
    ↕ PTY relay (child_process + script)
    ↕ IPC socket (~/.verboo/monitor/{sid}.sock)
    ↕ File watch (~/.verboo/monitor/sessions.json)
Verboo CLI Process
```

### Para testar

```bash
# 1. Build
cd /home/alvaro/verboo-code
bun build src/entrypoints/monitorServerProcess.ts --outfile dist/monitorServerProcess.js --target node --format esm

# 2. Start server
MONITOR_TOKEN_SKIP=true node dist/monitorServerProcess.js

# 3. Monitor HTML: http://localhost:8765
# 4. Lit frontend: http://localhost:5173 (com Vite proxy)
```

### Bugs conhecidos restantes
- `g++ -std=gnu++20` não suportado no WSL2 — node-pty não compila
- Usamos `child_process` + `script` como fallback (funcional mas sem resize real)
- Broadcast de session_state duplicado (polling + fs.watch)
