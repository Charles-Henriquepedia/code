import type { IncomingMessage, ServerResponse } from 'node:http'

export class AuthMiddleware {
  private tokens = new Set<string>()
  private enabled = false

  enable(): void {
    this.enabled = true
  }

  disable(): void {
    this.enabled = false
  }

  addToken(token: string): void {
    this.tokens.add(token)
  }

  removeToken(token: string): void {
    this.tokens.delete(token)
  }

  isEnabled(): boolean {
    return this.enabled
  }

  async authenticate(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    if (!this.enabled) return true

    const auth = req.headers.authorization
    if (!auth || !auth.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Missing or invalid authorization header', code: 'UNAUTHORIZED', statusCode: 401 }))
      return false
    }

    const token = auth.slice(7)
    if (!this.tokens.has(token)) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Invalid token', code: 'FORBIDDEN', statusCode: 403 }))
      return false
    }

    return true
  }

  generateToken(): string {
    const { randomBytes } = require('node:crypto')
    const token = randomBytes(32).toString('hex')
    this.tokens.add(token)
    return token
  }
}
