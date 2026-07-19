import * as React from 'react'
import type { LocalJSXCommandContext } from '../../types/command.js'
import type { LocalJSXCommandOnDone } from '../../types/command.js'
import { MonitorDashboard } from './MonitorDashboard.js'

export async function call(
  onDone: LocalJSXCommandOnDone,
  _context: LocalJSXCommandContext,
  _args: string,
): Promise<React.ReactNode> {
  return <MonitorDashboard onClose={onDone} />
}
