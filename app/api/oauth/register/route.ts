import { randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import { checkRateLimit } from '@/lib/rateLimit'
import { platnaRedirectUri } from '@/lib/oauth'
import { oauthJson, oauthPreflight, oauthBody } from '@/lib/oauthHttp'

/** RFC 7591 dynamická registrace veřejného klienta (bez secretu, PKCE povinné) */
export async function POST(req: Request) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (checkRateLimit(`oauth-register:${ip}`, 20, 60 * 60 * 1000).limited) {
    return oauthJson({ error: 'too_many_requests' }, 429)
  }

  const body = await oauthBody(req)
  const uris = Array.isArray(body.redirect_uris) ? body.redirect_uris : []
  if (uris.length === 0 || uris.length > 10 || !uris.every(platnaRedirectUri)) {
    return oauthJson({ error: 'invalid_redirect_uri', error_description: 'redirect_uris: https nebo http://localhost' }, 400)
  }
  if (body.token_endpoint_auth_method && body.token_endpoint_auth_method !== 'none') {
    return oauthJson({ error: 'invalid_client_metadata', error_description: 'Podporujeme jen veřejné klienty (none + PKCE)' }, 400)
  }

  const nazev = typeof body.client_name === 'string' && body.client_name.trim() ? body.client_name.trim().slice(0, 100) : 'MCP klient'
  const clientId = `fmcp_${randomBytes(16).toString('hex')}`
  const k = await prisma.oAuthKlient.create({ data: { clientId, nazev, redirectUris: uris as string[] } })
  console.log(`[ai-mcp] registrován klient ${k.clientId} (${nazev})`)

  return oauthJson({
    client_id: k.clientId,
    client_id_issued_at: Math.floor(k.vytvoreno.getTime() / 1000),
    client_name: k.nazev,
    redirect_uris: k.redirectUris,
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    token_endpoint_auth_method: 'none',
  }, 201)
}

export const OPTIONS = oauthPreflight
