import { odvolejToken } from '@/lib/oauth'
import { oauthJson, oauthPreflight, oauthBody } from '@/lib/oauthHttp'

/** RFC 7009 — vždy 200, i pro neznámý token */
export async function POST(req: Request) {
  const b = await oauthBody(req)
  await odvolejToken(b.token)
  return oauthJson({})
}

export const OPTIONS = oauthPreflight
