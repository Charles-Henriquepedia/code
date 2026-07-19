import * as React from 'react'
import { useEffect, useState } from 'react'
import { Box, Text, useInput } from '../../ink.js'
import chokidar from 'chokidar'
import { toString as qrToString } from 'qrcode'
import { readMonitorState, getStateFilePath } from '../../utils/monitor/monitorStateFile.js'
import type { MonitorServer } from '../../utils/monitor/monitorServer.js'
import type { MonitorSession } from '../../utils/monitor/monitorStateFile.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Filter = 'all' | 'running' | 'waiting_input' | 'stopped'

interface Props {
  onClose: () => void
  server?: MonitorServer
  serverError?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_SYMBOL: Record<string, { char: string; color: string }> = {
  running: { char: '●', color: 'green' },
  waiting_input: { char: '◐', color: 'yellow' },
  stopped: { char: '○', color: 'gray' },
}

function formatUptime(createdAt: number): string {
  const seconds = Math.floor((Date.now() - createdAt) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function truncate(s: string | undefined, max: number): string {
  if (!s) return ''
  if (s.length <= max) return s
  return s.slice(0, max - 1) + '…'
}

function getTerminalWidth(): number {
  return process.stdout.columns ?? 80
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export function MonitorDashboard({ onClose, server, serverError }: Props) {
  const [sessions, setSessions] = useState<MonitorSession[]>([])
  const [focusedIndex, setFocusedIndex] = useState(0)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [qrLines, setQrLines] = useState<string[]>([])

  // Generate QR code for server URL
  useEffect(() => {
    if (!server) return
    qrToString(server.url, { type: 'utf8', errorCorrectionLevel: 'L', small: true })
      .then(qr => setQrLines(qr.split('\n').filter(l => l.length > 0)))
      .catch(() => {})
  }, [server])

  // Watch the state file
  useEffect(() => {
    const path = getStateFilePath()

    // Read immediately — the file may not exist yet and chokidar won't fire
    // for non-existent files even with ignoreInitial: false.
    readMonitorState()
      .then(state => {
        const list = Object.values(state.sessions)
        list.sort((a, b) => a.createdAt - b.createdAt)
        setSessions(list)
        setLoading(false)
        setError(null)
      })
      .catch((err: unknown) => {
        setError((err as Error)?.message ?? 'read error')
        setLoading(false)
      })

    const watcher = chokidar.watch(path, {
      ignoreInitial: true,      // We already read initial state above
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 100 },
      ignorePermissionErrors: true,
    })
    const refresh = async () => {
      try {
        const state = await readMonitorState()
        const list = Object.values(state.sessions)
        list.sort((a, b) => a.createdAt - b.createdAt)
        setSessions(list)
        setError(null)
      } catch (err: unknown) {
        setError((err as Error)?.message ?? 'read error')
      }
    }
    watcher.on('change', refresh)
    watcher.on('add', refresh)
    return () => { watcher.close().catch(() => {}) }
  }, [])

  // Filtered & sorted list
  const filtered = sessions.filter(s => filter === 'all' || s.status === filter)

  // Clamp focus
  const maxIndex = Math.max(0, filtered.length - 1)
  const focused = focusedIndex > maxIndex ? maxIndex : focusedIndex

  // Keyboard
  useInput((_input, key) => {
    if (key.escape || key.ctrl === 'c') {
      onClose()
      return
    }
    switch (key.return ? 'enter' : '') {
      case 'enter':
        break
    }
  })

  useInput((input, key) => {
    if (key.upArrow || input === 'k') {
      setFocusedIndex(i => Math.max(0, i - 1))
    } else if (key.downArrow || input === 'j') {
      setFocusedIndex(i => Math.min(maxIndex, i + 1))
    } else if (input === 'q' || key.escape) {
      onClose()
    } else if (input === 'r') {
      setLoading(true)
      readMonitorState()
        .then(state => {
          setSessions(Object.values(state.sessions))
          setLoading(false)
        })
        .catch(() => setLoading(false))
    } else if (input === '1') {
      setFilter('all')
    } else if (input === '2') {
      setFilter('running')
    } else if (input === '3') {
      setFilter('waiting_input')
    } else if (input === '4') {
      setFilter('stopped')
    }
  })

  // Stats
  const runningCount = sessions.filter(s => s.status === 'running').length
  const waitingCount = sessions.filter(s => s.status === 'waiting_input').length
  const stoppedCount = sessions.filter(s => s.status === 'stopped').length
  const width = getTerminalWidth()

  if (serverError) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Server error: {serverError}</Text>
        <Text dimColor>Press q to close.</Text>
      </Box>
    )
  }

  if (loading) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text dimColor>Loading sessions...</Text>
      </Box>
    )
  }

  if (error) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text color="red">Error: {error}</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      {/* Header */}
      <Box borderStyle="single" borderColor="green" paddingX={1}>
        <Text bold> Session Monitor </Text>
        <Text color="green">● {runningCount}</Text>
        <Text> </Text>
        <Text color="yellow">◐ {waitingCount}</Text>
        <Text> </Text>
        <Text dimColor>○ {stoppedCount}</Text>
        <Text> | </Text>
        <Text dimColor>{filter === 'all' ? 'all' : filter}</Text>
        {ownId && <Text dimColor> | own: {truncate(ownId, 8)}</Text>}
      </Box>

      {/* Session rows */}
      <Box flexDirection="column" paddingX={1} paddingY={0}>
        {filtered.length === 0 && (
          <Text dimColor>No sessions found.</Text>
        )}
        {filtered.map((session, i) => {
          const isFocused = i === focused
          const isOwn = session.sessionId === ownId
          const sym = STATUS_SYMBOL[session.status] ?? STATUS_SYMBOL.stopped
          const cwd = truncate(session.cwd || '(no cwd)', 28)
          const model = truncate(session.model, 12)
          const uptime = formatUptime(session.createdAt)
          const msg = truncate(session.lastMessage, width - 70)

          return (
            <Box key={session.sessionId} height={1}>
              {/* Focus indicator */}
              {isFocused ? <Text color="cyan">▸</Text> : <Text> </Text>}

              {/* Status dot */}
              <Text color={sym.color as any}>{sym.char} </Text>

              {/* ID */}
              <Text bold={isOwn} dimColor={!isOwn && !isFocused}>
                {truncate(session.sessionId, 8)}
              </Text>
              <Text> </Text>

              {/* CWD */}
              <Text>{cwd}</Text>
              <Text> </Text>

              {/* Model */}
              <Text dimColor>{model}</Text>
              <Text> </Text>

              {/* Uptime */}
              <Text dimColor>{uptime}</Text>
              <Text> </Text>

              {/* Last message */}
              <Text dimColor>{msg}</Text>
            </Box>
          )
        })}
      </Box>

      {/* QR code / Server info */}
      {server && qrLines.length > 0 && (
        <Box flexDirection="column" paddingX={1} paddingY={0}>
          <Text bold color="cyan"> Mobile access </Text>
          <Text dimColor>{server.url}</Text>
          {qrLines.map((line, i) => (
            <Text key={i} dimColor>{line}</Text>
          ))}
        </Box>
      )}

      {/* Footer */}
      <Box borderStyle="single" borderColor="gray" paddingX={1}>
        <Text dimColor>
          {server ? `[q] quit server and dashboard` : `[↑↓/jk] nav  [q] quit  [r] refresh  [1-4] filter`}
        </Text>
      </Box>
    </Box>
  )
}
