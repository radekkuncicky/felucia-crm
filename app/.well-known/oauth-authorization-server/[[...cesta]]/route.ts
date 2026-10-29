import { issuerZ, metadataAutorizacnihoServeru } from '@/lib/oauth'
import { oauthJson, oauthPreflight } from '@/lib/oauthHttp'

// /.well-known/oauth-authorization-server (i s příponou cesty, RFC 8414)
export async function GET(req: Request) {
  return oauthJson(metadataAutorizacnihoServeru(issuerZ(req)))
}

export const OPTIONS = oauthPreflight
