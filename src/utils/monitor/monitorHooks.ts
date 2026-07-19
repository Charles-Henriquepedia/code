/**
 * Session-monitor hook registration.
 *
 * Registers function hooks on lifecycle events so that every Verboo Code
 * process writes its status to the shared `sessions.json` file. Hooks are
 * observation-only — they never block or modify any input/output.
 */

import type { AppState } from 'src/state/AppState.js'
import { getSessionId, getOriginalCwd } from '../../bootstrap/state.js'
import type { Message } from '../../types/message.js'
import { logForDebugging } from '../debug.js'
import { addFunctionHook } from '../hooks/sessionHooks.js'
import { registerCleanup } from '../cleanupRegistry.js'
import { upsertSession,
  removeSession,
  type MonitorSession,
} from './monitorStateFile.js'

// ---------------------------------------------------------------------------
// Hook IDs (stored so they can be unregistered)
// ---------------------------------------------------------------------------

const STORED_IDS = new Map<string, string[]>()

export function getRegisteredHookIds(sessionId: string): string[] {
  return STORED_IDS.get(sessionId) ?? []
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
function commonPatch(): Partial<MonitorSession> {
  return {
    cwd: getOriginalCwd(),
    pid: process.pid,
    tty: process.env.SSH_TTY || process.env.TMUX || undefined,
  }
}

/**
 * Register monitor hooks for a session (or subagent).
 *
 * Call this once per session at startup. The hooks fire on lifecycle events
 * and update the shared `sessions.json`.
 */
export function registerMonitorHooks(
  setAppState: (updater: (prev: AppState) => AppState) => void,
  sessionId: string,
  agentCtx?: { agentId?: string; parentSessionId?: string },
): string[] {
  const ids: string[] = []
  const pid = process.pid

  // ---- SessionStart ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'SessionStart',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          ...(agentCtx?.agentId ? { agentId: agentCtx.agentId } : {}),
          ...(agentCtx?.parentSessionId
            ? { parentSessionId: agentCtx.parentSessionId }
            : {}),
          status: 'running',
          createdAt: Date.now(),
        })
        return true
      },
      '[monitor] SessionStart',
    ),
  )

  // ---- UserPromptSubmit ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'UserPromptSubmit',
      '',
      async (messages: Message[]) => {
        const lastMessage = extractUserPrompt(messages)
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'running',
          lastMessage: lastMessage ? truncate(lastMessage, 120) : undefined,
        })
        return true
      },
      '[monitor] UserPromptSubmit',
    ),
  )

  // ---- PreToolUse ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'PreToolUse',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'running',
        })
        return true
      },
      '[monitor] PreToolUse',
    ),
  )

  // ---- PostToolUse ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'PostToolUse',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'running',
        })
        return true
      },
      '[monitor] PostToolUse',
    ),
  )

  // ---- PermissionRequest (user is being asked) ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'PermissionRequest',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'waiting_input',
        })
        return true
      },
      '[monitor] PermissionRequest',
    ),
  )

  // ---- Stop (turn ended) ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'Stop',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'stopped',
        })
        return true
      },
      '[monitor] Stop',
    ),
  )

  // ---- SessionEnd ----
  ids.push(
    addFunctionHook(
      setAppState,
      sessionId,
      'SessionEnd',
      '',
      async () => {
        await upsertSession(sessionId, {
          ...commonPatch(),
          status: 'stopped',
        })
        return true
      },
      '[monitor] SessionEnd',
    ),
  )

  STORED_IDS.set(sessionId, ids)

  // Cleanup: remove own entry on graceful shutdown
  registerCleanup(async () => {
    await removeSession(sessionId)
  })

  // Immediately create the initial entry so the dashboard sees us.
  upsertSession(sessionId, {
    ...commonPatch(),
    ...(agentCtx?.agentId ? { agentId: agentCtx.agentId } : {}),
    ...(agentCtx?.parentSessionId
      ? { parentSessionId: agentCtx.parentSessionId }
      : {}),
    status: 'running',
    createdAt: Date.now(),
  }).catch(() => {})

  return ids
}

/**
 * Unregister all monitor hooks for a session.
 *
 * Hooks are session-scoped and cleaned up when the session ends, so this
 * is primarily for clearing our tracking map.
 */
export function unregisterMonitorHooks(
  _setAppState: (updater: (prev: AppState) => AppState) => void,
  sessionId: string,
): void {
  STORED_IDS.delete(sessionId)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractUserPrompt(messages: Message[]): string | undefined {
  if (!Array.isArray(messages)) return undefined
  // The last message that looks like a user prompt
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (!msg) continue
    const content = (msg as Record<string, unknown>).content ?? (msg as Record<string, unknown>).message?.content
    if (typeof content === 'string' && content.length > 0) {
      return content
    }
    if (Array.isArray(content)) {
      const textParts = content.filter(
        (b: unknown) =>
          typeof b === 'object' &&
          (b as Record<string, unknown>).type === 'text',
      )
      if (textParts.length > 0) {
        return textParts
          .map(b => String((b as Record<string, unknown>).text ?? ''))
          .join(' ')
      }
    }
    // Stop at the first user-role message
    if (msg.role === 'user' || (msg as Record<string, unknown>).message?.role === 'user') {
      break
    }
  }
  return undefined
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}
