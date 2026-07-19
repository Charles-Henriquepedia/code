import * as React from 'react'
import type { LocalJSXCommandContext } from '../../types/command.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { MonitorDashboard } from './MonitorDashboard.js'
import { startMonitorServer } from '../../utils/monitor/monitorServer.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  args: string,
): Promise<React.ReactNode> {
  const flags = (args ?? '').split(/\s+/).filter(Boolean)
  const serve = flags.includes('--serve') || flags.includes('-s')
  const pub = flags.includes('--public') || flags.includes('-p')

  if (serve) {
    try {
      const server = await startMonitorServer({ public: pub })
      return <MonitorDashboard onClose={onDone} server={server} />
    } catch (err: unknown) {
      return <MonitorDashboard onClose={onDone} serverError={(err as Error)?.message ?? String(err)} />
    }
  }

  return <MonitorDashboard onClose={onDone} />
}
