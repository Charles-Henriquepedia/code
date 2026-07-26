export interface CommandInfo {
  name: string
  description: string
  aliases: string[]
  type: 'prompt' | 'local' | 'local-jsx'
  argumentHint: string | undefined
  source: string
  hidden: boolean
  enabled: boolean
  examples: string[]
}

export type { CommandInfo as Command }
