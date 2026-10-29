import { NextResponse } from 'next/server'

/**
 * OAuth/MCP endpointy volají klienti mimo prohlížečovou session (aplikace Claude,
 * desktopoví klienti) — CORS bez credentials je bezpečný, cookies se neposílají.
 */
export const OAUTH_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Mcp-Protocol-Version, Mcp-Session-Id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, Mcp-Session-Id',
}

export function oauthJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return NextResponse.json(body, { status, headers: { ...OAUTH_CORS, 'Cache-Control': 'no-store', ...extra } })
}

export function oauthPreflight() {
  return new NextResponse(null, { status: 204, headers: OAUTH_CORS })
}

/** Tělo OAuth požadavku: application/x-www-form-urlencoded (standard) nebo JSON */
export async function oauthBody(req: Request): Promise<Record<string, unknown>> {
  const ct = req.headers.get('content-type') ?? ''
  try {
    if (ct.includes('application/json')) return (await req.json()) as Record<string, unknown>
    return Object.fromEntries(new URLSearchParams(await req.text()))
  } catch {
    return {}
  }
}
