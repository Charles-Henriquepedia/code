import type { IncomingMessage, ServerResponse } from 'node:http'
import type { ApiDependencies } from '../server/HttpServer.js'

export function registerModelRoutes(
  handlers: Map<string, (req: IncomingMessage, res: ServerResponse, body?: string) => Promise<void>>,
  deps: ApiDependencies,
): void {
  handlers.set('GET:/api/v1/models', async (_req, res) => {
    const runtime = deps.runtimeRegistry.get('verboo')
    const models = runtime?.getModels() ?? []

    if (models.length === 0) {
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({
        models: [],
        notice: 'Nenhum modelo Verboo disponível. Execute `verboo /login` para autenticar sua conta.',
      }))
      return
    }

    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ models }))
  })
}
