import type { Command } from '../../commands.ts'

const monitorCommand = {
  type: 'local-jsx',
  name: 'monitor',
  description: 'Show live session monitor with all active Verboo Code sessions',
  aliases: ['sessions', 'ps', 'dashboard'],
  isEnabled: () => true,
  load: () => import('./monitor.jsx'),
} satisfies Command

export default monitorCommand
