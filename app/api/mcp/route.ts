import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { checkRateLimit } from '@/lib/rateLimit'
import { issuerZ, kontextZMcpTokenu } from '@/lib/oauth'
import { OAUTH_CORS, oauthJson, oauthPreflight } from '@/lib/oauthHttp'
import { vytvorMcpServer } from '@/lib/ai/mcp'

export const dynamic = 'force-dynamic'

/**
 * MCP konektor (Streamable HTTP, bezstavový — PM2 běží v clusteru, žádná
 * in-memory session). Autentizace: OAuth access token z /api/oauth/token.
 */
async function handle(req: Request): Promise<Response> {
  const ctx = await kontextZMcpTokenu(req)
  if (!ctx) {
    const meta = `${issuerZ(req)}/.well-known/oauth-protected-resource`
    const maToken = req.headers.get('authorization')?.startsWith('Bearer ')
    return oauthJson({ error: 'invalid_token' }, 401, {
      'WWW-Authenticate': `Bearer resource_metadata="${meta}"${maToken ? ', error="invalid_token"' : ''}`,
    })
  }

  if (checkRateLimit(`ai-mcp:${ctx.userId}`, 120, 60 * 1000).limited) return oauthJson({ error: 'too_many_requests' }, 429)

  try {
    const server = await vytvorMcpServer(ctx)
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
    await server.connect(transport)
    const res = await transport.handleRequest(req)
    const headers = new Headers(res.headers)
    for (const [k, v] of Object.entries(OAUTH_CORS)) headers.set(k, v)
    return new Response(res.body, { status: res.status, headers })
  } catch (err) {
    console.error('[ai-mcp] chyba:', err)
    return oauthJson({ error: 'server_error' }, 500)
  }
}

export const POST = handle
export const GET = handle
export const DELETE = handle
export const OPTIONS = oauthPreflight
