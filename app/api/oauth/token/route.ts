import { checkRateLimit } from '@/lib/rateLimit'
import { obnovToken, vymenKod } from '@/lib/oauth'
import { oauthJson, oauthPreflight, oauthBody } from '@/lib/oauthHttp'

export async function POST(req: Request) {
  const ip = req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? 'unknown'
  if (checkRateLimit(`oauth-token:${ip}`, 60, 60 * 1000).limited) return oauthJson({ error: 'too_many_requests' }, 429)

  const b = await oauthBody(req)
  const r =
    b.grant_type === 'authorization_code'
      ? await vymenKod({ code: b.code, clientId: b.client_id, redirectUri: b.redirect_uri, codeVerifier: b.code_verifier })
      : b.grant_type === 'refresh_token'
        ? await obnovToken({ refreshToken: b.refresh_token, clientId: b.client_id })
        : { error: 'unsupported_grant_type' }

  if ('error' in r) {
    console.log(`[ai-mcp] token ${String(b.grant_type)} zamítnut: ${r.error}`)
    return oauthJson(r, 400)
  }
  return oauthJson(r)
}

export const OPTIONS = oauthPreflight
