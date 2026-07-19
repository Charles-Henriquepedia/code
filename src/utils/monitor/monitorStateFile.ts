/**
 * Shared state file for the session monitor.
 *
 * Every Verboo Code process writes its session state to a single JSON file
 * at `~/.verboo/monitor/sessions.json`. A lightweight file lock (via the
 * existing proper-lockfile wrapper) serialises concurrent writes from
 * independent processes.
 *
 * Atomicity: write to a .tmp file then rename. There is no read-lock; a
 * read that races with a write may see stale data for one tick, which is
 * acceptable — the dashboard re-reads on every change event anyway.
 */

import { writeFile, mkdir, readFile, rename } from 'fs/promises'
import { join } from 'path'
import { getClaudeConfigHomeDir } from '../envUtils.js'
import { lock } from '../lockfile.js'
import { logForDebugging } from '../debug.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MonitorSessionStatus = 'running' | 'waiting_input' | 'stopped'

export type MonitorSession = {
  sessionId: string
  agentId?: string
  parentSessionId?: string
  cwd: string
  status: MonitorSessionStatus
  tty?: string
  createdAt: number
  updatedAt: number
  lastMessage?: string
  model?: string
  pid: number
}

export type MonitorStateFile = {
  version: 1
  updatedAt: number
  sessions: Record<string, MonitorSession>
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const MONITOR_DIR = 'monitor'
const STATE_FILENAME = 'sessions.json'
const TMP_SUFFIX = '.tmp'

export function getMonitorDir(): string {
  return join(getClaudeConfigHomeDir(), MONITOR_DIR)
}

export function getStateFilePath(): string {
  return join(getMonitorDir(), STATE_FILENAME)
}

// ---------------------------------------------------------------------------
// I/O
// ---------------------------------------------------------------------------

/**
 * Read the monitor state file. Returns an empty file when nothing exists.
 */
export async function readMonitorState(): Promise<MonitorStateFile> {
  const path = getStateFilePath()
  try {
    const raw = await readFile(path)
    const parsed = JSON.parse(raw.toString()) as MonitorStateFile
    if (parsed && typeof parsed === 'object' && parsed.version === 1) {
      return parsed
    }
    logForDebugging(
      `[Monitor] state file has unexpected shape, resetting`,
      { level: 'debug' },
    )
    return emptyState()
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException
    if (e.code === 'ENOENT') {
      return emptyState()
    }
    logForDebugging(
      `[Monitor] failed to read state file: ${e.message ?? e}`,
      { level: 'warn' },
    )
    return emptyState()
  }
}

/**
 * Overwrite the monitor state file. The write is atomic: we write to a .tmp
 * sibling and rename.
 */
export async function writeMonitorState(
  state: MonitorStateFile,
): Promise<void> {
  const path = getStateFilePath()
  const tmpPath = path + TMP_SUFFIX
  state.updatedAt = Date.now()
  await writeFile(tmpPath, JSON.stringify(state, null, 2))
  await rename(tmpPath, path)
}

/**
 * Upsert a single session entry. A file-level lock prevents concurrent
 * writers from different processes from clobbering each other.
 */
export async function upsertSession(
  sessionId: string,
  patch: Partial<MonitorSession>,
): Promise<void> {
  const dir = getMonitorDir()
  await mkdir(dir, { recursive: true })

  let release: (() => Promise<void>) | undefined
  try {
    release = await lock(dir, { stale: 5000, retries: { retries: 3, minTimeout: 50, maxTimeout: 200 } })
    const state = await readMonitorState()
    state.sessions[sessionId] = {
      ...(state.sessions[sessionId] ?? blankSession(sessionId)),
      ...patch,
      updatedAt: Date.now(),
    }
    await writeMonitorState(state)
  } catch (err: unknown) {
    logForDebugging(
      `[Monitor] upsertSession failed: ${(err as Error)?.message ?? err}`,
      { level: 'error' },
    )
  } finally {
    try {
      await release?.()
    } catch {
      // lock release errors are non-fatal
    }
  }
}

/**
 * Remove a session entry by id.
 */
export async function removeSession(sessionId: string): Promise<void> {
  const dir = getMonitorDir()
  await mkdir(dir, { recursive: true })
  let release: (() => Promise<void>) | undefined
  try {
    release = await lock(dir, { stale: 5000, retries: { retries: 3, minTimeout: 50, maxTimeout: 200 } })
    const state = await readMonitorState()
    delete state.sessions[sessionId]
    await writeMonitorState(state)
  } catch (err: unknown) {
    logForDebugging(
      `[Monitor] removeSession failed: ${(err as Error)?.message ?? err}`,
      { level: 'error' },
    )
  } finally {
    try {
      await release?.()
    } catch {
      // non-fatal
    }
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyState(): MonitorStateFile {
  return { version: 1, updatedAt: Date.now(), sessions: {} }
}

function blankSession(sessionId: string): MonitorSession {
  return {
    sessionId,
    cwd: '',
    status: 'stopped',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    pid: 0,
  }
}
