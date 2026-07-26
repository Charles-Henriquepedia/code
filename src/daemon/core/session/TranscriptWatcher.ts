import { watch, type FSWatcher } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { EventEmitter } from 'node:events'

/**
 * Watches a JSONL transcript file for appends and emits 'append' events
 * with the newly added lines parsed as JSON.
 *
 * Used for live sync between CLI terminal and web frontend: when the CLI
 * writes new entries to the transcript, the watcher notifies all web clients
 * connected to the same session via WebSocket.
 */
export class TranscriptWatcher extends EventEmitter {
  private filePath: string
  private watcher: FSWatcher | null = null
  private lastSize = 0
  private debounceTimer: NodeJS.Timeout | null = null
  private readonly debounceMs = 50

  constructor(filePath: string) {
    super()
    this.filePath = filePath
  }

  async start(): Promise<void> {
    // Initialize lastSize to current file size so we only emit NEW appends
    try {
      const { stat } = await import('node:fs/promises')
      const s = await stat(this.filePath)
      this.lastSize = s.size
      console.log(`[TranscriptWatcher] Started watching ${this.filePath} (initial size: ${this.lastSize})`)
    } catch {
      this.lastSize = 0
      console.log(`[TranscriptWatcher] File not found: ${this.filePath}`)
    }

    // Watch the file for changes (persistent: false so it doesn't block exit)
    this.watcher = watch(this.filePath, { persistent: false }, (eventType) => {
      console.log(`[TranscriptWatcher] Event: ${eventType}`)
      if (eventType === 'rename') {
        // File was renamed/rotated - try to re-acquire
        this.watcher?.close()
        setTimeout(() => this.start().catch(() => {}), 100)
        return
      }
      this.scheduleRead()
    })

    this.watcher.on('error', (err) => {
      console.log(`[TranscriptWatcher] Watcher error: ${err.message}`)
    })
  }

  private scheduleRead(): void {
    if (this.debounceTimer) return
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.readNewEntries().catch(() => {})
    }, this.debounceMs)
  }

  private async readNewEntries(): Promise<void> {
    try {
      const { stat } = await import('node:fs/promises')
      const s = await stat(this.filePath)
      if (s.size <= this.lastSize) return

      const fd = await readFile(this.filePath, { encoding: 'utf-8' })
      // Read only the new bytes (from lastSize to current size)
      const newContent = fd.slice(this.lastSize)
      this.lastSize = s.size

      // Parse each line as JSON
      const lines = newContent.split('\n').filter((l) => l.trim())
      for (const line of lines) {
        try {
          const entry = JSON.parse(line)
          this.emit('append', entry)
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // file might be temporarily unavailable
    }
  }

  stop(): void {
    this.watcher?.close()
    this.watcher = null
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
  }
}
