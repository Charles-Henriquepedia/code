import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import type { ModelInfo } from '../../types/runtime.js'

/** Injeta token para ser usado nas requisições */
export function setModelToken(token: string): void {
  process.env.CLAUDE_CODE_OAUTH_TOKEN = token
}

function findToken(): string | null {
  // 1. Env var
  if (process.env.CLAUDE_CODE_OAUTH_TOKEN) return process.env.CLAUDE_CODE_OAUTH_TOKEN

  // 2. Credentials file (~/.verboo/.credentials.json)
  try {
    const credPath = join(homedir(), '.verboo', '.credentials.json')
    const data = readFileSync(credPath, 'utf-8')
    const parsed = JSON.parse(data) as {
      verbooOauth?: { accessToken?: string }
    }
    const token = parsed.verbooOauth?.accessToken
    if (token) {
      process.env.CLAUDE_CODE_OAUTH_TOKEN = token
      return token
    }
  } catch {}

  return null
}

export class ModelManager {
  private models: ModelInfo[] = []
  private loaded = false
  private loadPromise: Promise<void> | null = null

  async load(): Promise<void> {
    if (this.loaded) return
    if (this.loadPromise) return this.loadPromise
    // Try to find token first, then fetch
    findToken()
    this.loadPromise = this.tryFetchOrFallback()
    return this.loadPromise
  }

  private async tryFetchOrFallback(): Promise<void> {
    const token = process.env.CLAUDE_CODE_OAUTH_TOKEN ?? ''



    // Try fetching from Verboo API with token
    if (token) {
      try {
        const { fetchVerbooModels } = await import('../../../services/api/verbooModels.js')
        const fetched = await fetchVerbooModels(token)
        if (fetched && fetched.length > 0) {
          this.models = fetched.map((m) => {
            return {
              id: m.id,
              name: m.displayName ?? m.id,
              provider: 'verboo',
              capabilities: this.extractCaps(m),
              contextWindow: m.contextWindow ?? 200_000,
              supportsThinking: !!m.reasoning?.effortLevels?.length
            }
          })
          this.loaded = true
          return
        }
      } catch (err) {
        console.warn('ModelManager: fetch failed:', (err as Error).message)
      }
    }

    // Fallback: use getModelOptions (reuses Verboo cache if populated)
    try {
      const { getModelOptions } = await import('../../../utils/model/modelOptions.js')
      const options = getModelOptions()
      this.models = options.map((opt) => {
        return {
          id: opt.value,
          name: opt.label ?? opt.value,
          provider: 'verboo',
          capabilities: ['text', 'code'],
          contextWindow: 200_000,
          supportsThinking: false
        }
      })
    } catch {
      this.models = []
    }

    this.loaded = true
  }

  private extractCaps(m: { vision?: boolean; vision_enabled?: boolean; reasoning?: { effortLevels?: string[] }; tool_use?: boolean; tool_use_enabled?: boolean }): string[] {
    const caps: string[] = ['text', 'code']
    if (m.vision ?? m.vision_enabled) caps.push('vision')
    if (m.reasoning?.effortLevels?.length) caps.push('reasoning')
    if (m.tool_use ?? m.tool_use_enabled) caps.push('tools')
    return caps
  }

  getAll(): ModelInfo[] {
    return this.models
  }

  get(id: string): ModelInfo | undefined {
    return this.models.find((m) => m.id === id)
  }
}
