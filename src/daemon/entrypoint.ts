#!/usr/bin/env node
import { DaemonCLI } from './daemon/DaemonCLI.js'

const args = process.argv.slice(2)
const command = args[0] ?? 'start'

async function main(): Promise<void> {
  switch (command) {
    case 'start':
      await DaemonCLI.start(args.slice(1))
      break
    case 'stop':
      await DaemonCLI.stop()
      break
    case 'status':
      await DaemonCLI.status()
      break
    case 'logs':
      await DaemonCLI.logs()
      break
    case 'restart': {
      await DaemonCLI.stop()
      await DaemonCLI.start(args.slice(1))
      break
    }
    case '--help':
    case '-h':
    case 'help':
      console.log(`Verboo Daemon CLI

Usage: verboo-daemon <command> [options]

Commands:
  start [--port <port>] [--host <host>] [--foreground|-f]
      Start the daemon. Default: detached (fire-and-forget).
      Use --foreground to run in the current shell.
  stop
      Stop the running daemon.
  status
      Show daemon status, PID, log paths.
  logs
      Tail daemon logs (Ctrl+C to exit).
  restart [--port <port>] [--host <host>]
      Stop and start again.

Files:
  PID:   ~/.verboo/daemon/daemon.pid
  Logs:  ~/.verboo/daemon/daemon.log
  Err:   ~/.verboo/daemon/daemon.err

Examples:
  verboo-daemon start                          # fire-and-forget on default port 8765
  verboo-daemon start --port 3000              # custom port
  verboo-daemon start --host 0.0.0.0           # bind to all interfaces
  verboo-daemon start --foreground             # block current shell
  verboo-daemon logs                           # follow logs
  verboo-daemon stop                           # graceful shutdown`)
      break
    default:
      console.error(`Unknown command: ${command}`)
      console.error(`Run 'verboo-daemon help' for usage.`)
      process.exit(1)
  }
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
