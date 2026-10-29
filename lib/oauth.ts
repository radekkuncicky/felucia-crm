import { createHash, randomBytes, timingSafeEqual } from 'crypto'
import { prisma } from './prisma'
import { isSessionValid, loadPermsSnapshot } from './permsSnapshot'
import { resolvePermissions } from './permissions'
import { getPlanLimits } from './planLimits'
import type { AiKontext } from './ai/types'

/**
 * OAuth 2.1 autorizační server pro MCP konektor (aplikace Claude → /api/mcp).
 * Veřejní klienti z dynamické registrace, jen authorization_code + PKCE S256
 * a rotující refresh token. Tokeny jsou náhodné řetězce, v DB jen jejich SHA-256.
 * Tenant (orgId) je pevně v grantu — nikdy ho neurčuje vstup nástroje.
 *
 * Holý `prisma` je tu záměrně: běží před resolvnutím org (stejně jako auth).
 */

export const OAUTH_SCOPE = 'felucia'
export const KOD_TTL_MS = 5 * 60 * 1000
export const ACCESS_TTL_S = 60 * 60
export const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
const EXTRA_HOSTS = ['crm.workspace-nanto.cz']

/** Je host náš (felucia.io, subdoména, NANTO interní, localhost pro dev/E2E)? */
function nasHost(host: string) {
  const h = host.toLowerCase().replace(/:\d+$/, '')
  return h === ROOT_DOMAIN || h.endsWith(`.${ROOT_DOMAIN}`) || EXTRA_HOSTS.includes(h) || h === 'localhost' || h === '127.0.0.1'
}

/**
 * Veřejná adresa serveru podle požadavku (za nginx: Host + X-Forwarded-Proto).
 * Neznámý host → NEXTAUTH_URL, aby šlo podvrhnout issuer cizí doménou.
 */
export function issuerZ(req: Request): string {
  const host = req.headers.get('host') ?? ''
  if (host && nasHost(host)) {
    const local = /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host)
    const proto = req.headers.get('x-forwarded-proto')?.split(',')[0].trim() || (local ? 'http' : 'https')
    return `${proto}://${host}`
  }
  return new URL(process.env.NEXTAUTH_URL ?? `https://${ROOT_DOMAIN}`).origin
}

export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')
const nahodny = (prefix: string) => `${prefix}${randomBytes(32).toString('base64url')}`

/** PKCE S256: BASE64URL(SHA256(verifier)) == challenge */
export function overPkce(verifier: unknown, challenge: string): boolean {
  if (typeof verifier !== 'string' || !/^[A-Za-z0-9\-._~]{43,128}$/.test(verifier)) return false
  const a = Buffer.from(createHash('sha256').update(verifier).digest('base64url'))
  const b = Buffer.from(challenge)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Povolené redirect URI pro registraci: https, nebo loopback http (desktopové klienty) */
export function platnaRedirectUri(uri: unknown): uri is string {
  if (typeof uri !== 'string' || uri.length > 2000) return false
  try {
    const u = new URL(uri)
    if (u.hash) return false
    if (u.protocol === 'https:') return true
    return u.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname)
  } catch {
    return false
  }
}

export function metadataAutorizacnihoServeru(issuer: string) {
  return {
    issuer,
    authorization_endpoint: `${issuer}/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    revocation_endpoint: `${issuer}/api/oauth/revoke`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    revocation_endpoint_auth_methods_supported: ['none'],
    scopes_supported: [OAUTH_SCOPE],
  }
}

export function metadataChranenehoZdroje(issuer: string) {
  return {
    resource: `${issuer}/api/mcp`,
    authorization_servers: [issuer],
    scopes_supported: [OAUTH_SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Felucia CRM',
  }
}

/** Vydá kód po souhlasu uživatele (org a uživatel ze session) */
export async function vydejKod(p: {
  orgId: string; userId: string; klientId: string; redirectUri: string; codeChallenge: string; resource: string | null
}): Promise<string> {
  const kod = nahodny('fmcp_c_')
  await prisma.oAuthKod.create({
    data: { ...p, kodHash: hashToken(kod), expiruje: new Date(Date.now() + KOD_TTL_MS) },
  })
  return kod
}

function tokenOdpoved(access: string, refresh: string) {
  return { access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope: OAUTH_SCOPE }
}

export type TokenChyba = { error: string; error_description?: string }

/** grant_type=authorization_code: jednorázový kód + PKCE → nové připojení */
export async function vymenKod(p: {
  code: unknown; clientId: unknown; redirectUri: unknown; codeVerifier: unknown
}): Promise<ReturnType<typeof tokenOdpoved> | TokenChyba> {
  if (typeof p.code !== 'string' || typeof p.clientId !== 'string') return { error: 'invalid_request' }
  const kod = await prisma.oAuthKod.findUnique({ where: { kodHash: hashToken(p.code) }, include: { klient: true } })
  if (!kod || kod.klient.clientId !== p.clientId || kod.expiruje < new Date()) return { error: 'invalid_grant' }
  if (kod.redirectUri !== p.redirectUri) return { error: 'invalid_grant', error_description: 'redirect_uri nesouhlasí' }
  if (!overPkce(p.codeVerifier, kod.codeChallenge)) return { error: 'invalid_grant', error_description: 'PKCE ověření selhalo' }

  // jednorázovost atomicky — souběžná výměna téhož kódu projde jen jednou
  const zabrano = await prisma.oAuthKod.updateMany({ where: { id: kod.id, pouzito: null }, data: { pouzito: new Date() } })
  if (zabrano.count !== 1) return { error: 'invalid_grant' }

  const access = nahodny('fmcp_a_')
  const refresh = nahodny('fmcp_r_')
  await prisma.oAuthPripojeni.create({
    data: {
      orgId: kod.orgId, userId: kod.userId, klientId: kod.klientId,
      accessHash: hashToken(access), accessExpiruje: new Date(Date.now() + ACCESS_TTL_S * 1000),
      refreshHash: hashToken(refresh), refreshExpiruje: new Date(Date.now() + REFRESH_TTL_MS),
    },
  })
  return tokenOdpoved(access, refresh)
}

/** grant_type=refresh_token: rotace obou tokenů; starý refresh přestává platit */
export async function obnovToken(p: { refreshToken: unknown; clientId: unknown }): Promise<ReturnType<typeof tokenOdpoved> | TokenChyba> {
  if (typeof p.refreshToken !== 'string') return { error: 'invalid_request' }
  const hash = hashToken(p.refreshToken)
  const g = await prisma.oAuthPripojeni.findUnique({ where: { refreshHash: hash }, include: { klient: true } })
  if (!g || g.zruseno || g.refreshExpiruje < new Date()) return { error: 'invalid_grant' }
  if (typeof p.clientId === 'string' && p.clientId !== g.klient.clientId) return { error: 'invalid_grant' }

  const access = nahodny('fmcp_a_')
  const refresh = nahodny('fmcp_r_')
  const r = await prisma.oAuthPripojeni.updateMany({
    where: { id: g.id, refreshHash: hash, zruseno: null },
    data: {
      accessHash: hashToken(access), accessExpiruje: new Date(Date.now() + ACCESS_TTL_S * 1000),
      refreshHash: hashToken(refresh), refreshExpiruje: new Date(Date.now() + REFRESH_TTL_MS),
    },
  })
  if (r.count !== 1) return { error: 'invalid_grant' }
  return tokenOdpoved(access, refresh)
}

/** RFC 7009: zneplatní připojení podle access i refresh tokenu; neznámý token = OK */
export async function odvolejToken(token: unknown) {
  if (typeof token !== 'string') return
  const hash = hashToken(token)
  await prisma.oAuthPripojeni.updateMany({
    where: { OR: [{ accessHash: hash }, { refreshHash: hash }], zruseno: null },
    data: { zruseno: new Date() },
  })
}

/**
 * Bearer token z MCP požadavku → kontext asistentky. Role, oprávnění, plán
 * a aktivita uživatele se berou z DB (změna adminem se projeví hned, jako u mobilu).
 */
export async function kontextZMcpTokenu(req: Request): Promise<AiKontext | null> {
  const auth = req.headers.get('authorization')
  if (!auth?.startsWith('Bearer ')) return null
  const g = await prisma.oAuthPripojeni.findUnique({
    where: { accessHash: hashToken(auth.slice(7).trim()) },
    select: { id: true, orgId: true, userId: true, accessExpiruje: true, zruseno: true, posledniPouziti: true },
  })
  if (!g || g.zruseno || g.accessExpiruje < new Date()) return null

  const snap = await loadPermsSnapshot(g.userId)
  if (!isSessionValid(snap, undefined) || !getPlanLimits(snap.plan).canUseAI) return null
  const user = await prisma.user.findUnique({ where: { id: g.userId }, select: { jmeno: true, orgId: true } })
  if (!user || user.orgId !== g.orgId) return null

  if (!g.posledniPouziti || Date.now() - g.posledniPouziti.getTime() > 5 * 60 * 1000) {
    await prisma.oAuthPripojeni.update({ where: { id: g.id }, data: { posledniPouziti: new Date() } }).catch(() => {})
  }

  return {
    orgId: g.orgId,
    userId: g.userId,
    role: snap.role,
    jmeno: user.jmeno,
    perms: resolvePermissions(snap.role, snap.permissions, snap.plan),
    zdroj: 'mcp',
  }
}

export interface AutorizacniPozadavek {
  klient: { id: string; clientId: string; nazev: string }
  redirectUri: string
  codeChallenge: string
  state: string | null
  resource: string | null
}

/**
 * Ověří parametry /oauth/authorize. `fatalni` = neznámý klient / redirect_uri —
 * pak se NESMÍ přesměrovat (open redirect), jen zobrazit chybu.
 */
export async function overAutorizacniPozadavek(q: Record<string, unknown>): Promise<
  | { ok: true; p: AutorizacniPozadavek }
  | { ok: false; fatalni: true; chyba: string }
  | { ok: false; fatalni: false; redirect: string }
> {
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const clientId = str(q.client_id)
  const redirectUri = str(q.redirect_uri)
  const klient = clientId ? await prisma.oAuthKlient.findUnique({ where: { clientId } }) : null
  if (!klient) return { ok: false, fatalni: true, chyba: 'Neznámá aplikace (client_id).' }
  if (!redirectUri || !klient.redirectUris.includes(redirectUri)) {
    return { ok: false, fatalni: true, chyba: 'Adresa pro návrat (redirect_uri) není u aplikace registrovaná.' }
  }

  const state = str(q.state)
  const chyba = (error: string) => {
    const u = new URL(redirectUri)
    u.searchParams.set('error', error)
    if (state) u.searchParams.set('state', state)
    return { ok: false as const, fatalni: false as const, redirect: u.toString() }
  }
  if (q.response_type !== 'code') return chyba('unsupported_response_type')
  const codeChallenge = str(q.code_challenge)
  if (!codeChallenge || q.code_challenge_method !== 'S256' || !/^[A-Za-z0-9\-_]{43}$/.test(codeChallenge)) {
    return chyba('invalid_request')
  }

  return {
    ok: true,
    p: {
      klient: { id: klient.id, clientId: klient.clientId, nazev: klient.nazev },
      redirectUri, codeChallenge, state, resource: str(q.resource),
    },
  }
}

/** Kam přesměrovat po souhlasu: redirect_uri?code=…&state=… */
export function redirectSKodem(p: AutorizacniPozadavek, kod: string) {
  const u = new URL(p.redirectUri)
  u.searchParams.set('code', kod)
  if (p.state) u.searchParams.set('state', p.state)
  return u.toString()
}
