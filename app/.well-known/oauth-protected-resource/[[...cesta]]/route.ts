import { issuerZ, metadataChranenehoZdroje } from '@/lib/oauth'
import { oauthJson, oauthPreflight } from '@/lib/oauthHttp'

// /.well-known/oauth-protected-resource (i s příponou cesty zdroje /api/mcp, RFC 9728)
export async function GET(req: Request) {
  return oauthJson(metadataChranenehoZdroje(issuerZ(req)))
}

export const OPTIONS = oauthPreflight
