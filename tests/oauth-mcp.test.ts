import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createHash, randomBytes } from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  overPkce, platnaRedirectUri, vydejKod, vymenKod, obnovToken, odvolejToken,
  kontextZMcpTokenu, overAutorizacniPozadavek,
} from '@/lib/oauth'
import { POST as register } from '@/app/api/oauth/register/route'
import { POST as mcp } from '@/app/api/mcp/route'

/**
 * MCP konektor: OAuth 2.1 (DCR + PKCE + rotace refresh tokenu + odvolání)
 * a /api/mcp nad sdílenými nástroji — tenant výhradně z tokenu.
 */

const RUN = `mcp-${Date.now()}`
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback'

let orgA: { id: string }
let orgB: { id: string }
let userA: { id: string }
let zakazkaA: string
let zakazkaB: string
let klient: { id: string; clientId: string }

const verifier = randomBytes(40).toString('base64url')
const challenge = createHash('sha256').update(verifier).digest('base64url')

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'MCP A', slug: RUN, plan: 'STANDARD' } })
  orgB = await prisma.organization.create({ data: { nazev: 'MCP B', slug: `${RUN}-b`, plan: 'STANDARD' } })
  userA = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Radek MCP', email: `${RUN}@test.cz`, hesloHash: 'x', role: 'ADMIN' } })
  const kA = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jana', prijmeni: 'A' } })
  const kB = await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Petr', prijmeni: 'B' } })
  zakazkaA = (await prisma.zakazka.create({ data: { orgId: orgA.id, cislo: `${RUN}-1`, klientId: kA.id, nazev: 'TČ A' } })).id
  zakazkaB = (await prisma.zakazka.create({ data: { orgId: orgB.id, cislo: `${RUN}-B`, klientId: kB.id, nazev: 'Cizí' } })).id
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.oAuthPripojeni.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.oAuthKod.deleteMany({ where: { orgId: { in: orgIds } } })
  if (klient) await prisma.oAuthKlient.deleteMany({ where: { id: klient.id } })
  await prisma.aiAuditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.zakazka.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

function mcpReq(token: string | null, body: unknown) {
  return new Request('https://felucia.io/api/mcp', {
    method: 'POST',
    headers: {
      host: 'felucia.io',
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': '2025-06-18',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe('pomocné funkce', () => {
  it('PKCE S256', () => {
    expect(overPkce(verifier, challenge)).toBe(true)
    expect(overPkce(randomBytes(40).toString('base64url'), challenge)).toBe(false)
    expect(overPkce('kratky', challenge)).toBe(false)
  })

  it('redirect URI jen https nebo loopback', () => {
    expect(platnaRedirectUri(REDIRECT)).toBe(true)
    expect(platnaRedirectUri('http://localhost:6274/cb')).toBe(true)
    expect(platnaRedirectUri('http://evil.cz/cb')).toBe(false)
    expect(platnaRedirectUri('javascript:alert(1)')).toBe(false)
  })
})

describe('OAuth tok', () => {
  let access = ''
  let refresh = ''

  it('dynamická registrace klienta', async () => {
    const res = await register(new Request('https://felucia.io/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `t-${RUN}` },
      body: JSON.stringify({ client_name: 'Claude', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none' }),
    }))
    expect(res.status).toBe(201)
    const data = await res.json()
    klient = (await prisma.oAuthKlient.findUnique({ where: { clientId: data.client_id } }))!
    expect(klient).toBeTruthy()

    const spatne = await register(new Request('https://felucia.io/api/oauth/register', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-real-ip': `t-${RUN}` },
      body: JSON.stringify({ redirect_uris: ['http://evil.cz/cb'] }),
    }))
    expect(spatne.status).toBe(400)
  })

  it('autorizační požadavek: neznámý klient / cizí redirect se nepřesměrují', async () => {
    const zaklad = { response_type: 'code', code_challenge: challenge, code_challenge_method: 'S256', state: 'xyz' }
    const neznamy = await overAutorizacniPozadavek({ ...zaklad, client_id: 'nic', redirect_uri: REDIRECT })
    expect(neznamy).toMatchObject({ ok: false, fatalni: true })
    const cizi = await overAutorizacniPozadavek({ ...zaklad, client_id: klient.clientId, redirect_uri: 'https://evil.cz/cb' })
    expect(cizi).toMatchObject({ ok: false, fatalni: true })
    const bezPkce = await overAutorizacniPozadavek({ ...zaklad, client_id: klient.clientId, redirect_uri: REDIRECT, code_challenge_method: 'plain' })
    expect(bezPkce.ok).toBe(false)
    if (!bezPkce.ok && !bezPkce.fatalni) expect(bezPkce.redirect).toMatch(/error=invalid_request&state=xyz/)
    expect((await overAutorizacniPozadavek({ ...zaklad, client_id: klient.clientId, redirect_uri: REDIRECT })).ok).toBe(true)
  })

  it('kód + PKCE → tokeny; kód jen jednou, špatný verifier neprojde', async () => {
    const kod = await vydejKod({ orgId: orgA.id, userId: userA.id, klientId: klient.id, redirectUri: REDIRECT, codeChallenge: challenge, resource: null })
    const zly = await vymenKod({ code: kod, clientId: klient.clientId, redirectUri: REDIRECT, codeVerifier: randomBytes(40).toString('base64url') })
    expect(zly).toMatchObject({ error: 'invalid_grant' })

    const r = await vymenKod({ code: kod, clientId: klient.clientId, redirectUri: REDIRECT, codeVerifier: verifier })
    if ('error' in r) throw new Error(r.error)
    access = r.access_token
    refresh = r.refresh_token
    expect(r.token_type).toBe('Bearer')

    const znovu = await vymenKod({ code: kod, clientId: klient.clientId, redirectUri: REDIRECT, codeVerifier: verifier })
    expect(znovu).toMatchObject({ error: 'invalid_grant' })

    // v DB jen hashe
    const g = await prisma.oAuthPripojeni.findFirst({ where: { orgId: orgA.id } })
    expect(g?.accessHash).not.toBe(access)
  })

  it('token → kontext s tenantem z grantu', async () => {
    const ctx = await kontextZMcpTokenu(new Request('https://x', { headers: { authorization: `Bearer ${access}` } }))
    expect(ctx).toMatchObject({ orgId: orgA.id, userId: userA.id, zdroj: 'mcp', jmeno: 'Radek MCP' })
    expect(await kontextZMcpTokenu(new Request('https://x', { headers: { authorization: 'Bearer nesmysl' } }))).toBeNull()
  })

  it('/api/mcp bez tokenu → 401 s odkazem na metadata', async () => {
    const res = await mcp(mcpReq(null, { jsonrpc: '2.0', id: 1, method: 'tools/list' }))
    expect(res.status).toBe(401)
    expect(res.headers.get('www-authenticate')).toContain('resource_metadata="https://felucia.io/.well-known/oauth-protected-resource"')
  })

  it('initialize: instrukce s kontextem vlastní firmy, ne cizí', async () => {
    await prisma.organization.update({ where: { id: orgA.id }, data: { aiContext: 'Kontext A' } })
    await prisma.organization.update({ where: { id: orgB.id }, data: { aiContext: 'Tajné B' } })
    const res = await mcp(mcpReq(access, {
      jsonrpc: '2.0', id: 0, method: 'initialize',
      params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'test', version: '1' } },
    }))
    expect(res.status).toBe(200)
    const { result } = await res.json()
    expect(result.instructions).toContain('Kontext A')
    expect(result.instructions).not.toContain('Tajné B')
    expect(result.capabilities.tools).toBeTruthy()
  })

  it('tools/list: zápisy s destructiveHint, čtení readOnly', async () => {
    const res = await mcp(mcpReq(access, { jsonrpc: '2.0', id: 2, method: 'tools/list' }))
    expect(res.status).toBe(200)
    const { result } = await res.json()
    const byName = Object.fromEntries(result.tools.map((t: { name: string }) => [t.name, t]))
    expect(byName.update_order_status.annotations).toMatchObject({ destructiveHint: true, readOnlyHint: false })
    expect(byName.get_order.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false })
    expect(byName.get_order.inputSchema.properties.zakazkaId).toBeTruthy()
  })

  it('tools/call: vlastní zakázka ano, cizí ani s podstrčeným orgId ne; audit se zdrojem mcp', async () => {
    const vlastni = await (await mcp(mcpReq(access, {
      jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'get_order', arguments: { zakazkaId: zakazkaA } },
    }))).json()
    expect(vlastni.result.isError).toBe(false)
    expect(JSON.parse(vlastni.result.content[0].text).id).toBe(zakazkaA)

    const cizi = await (await mcp(mcpReq(access, {
      jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'get_order', arguments: { zakazkaId: zakazkaB, orgId: orgB.id, tenant_id: orgB.id } },
    }))).json()
    expect(cizi.result.isError).toBe(true)

    const audit = await prisma.aiAuditLog.findMany({ where: { orgId: orgA.id, nastroj: 'get_order' } })
    expect(audit.every(a => a.zdroj === 'mcp')).toBe(true)
    expect(audit.some(a => JSON.stringify(a.vstup).includes(orgB.id))).toBe(false)
    expect(await prisma.aiAuditLog.count({ where: { orgId: orgB.id } })).toBe(0)
  })

  it('refresh rotuje oba tokeny, starý refresh i access přestanou platit', async () => {
    const r = await obnovToken({ refreshToken: refresh, clientId: klient.clientId })
    if ('error' in r) throw new Error(r.error)
    expect(await obnovToken({ refreshToken: refresh, clientId: klient.clientId })).toMatchObject({ error: 'invalid_grant' })
    expect(await kontextZMcpTokenu(new Request('https://x', { headers: { authorization: `Bearer ${access}` } }))).toBeNull()
    access = r.access_token
    refresh = r.refresh_token
    expect(await kontextZMcpTokenu(new Request('https://x', { headers: { authorization: `Bearer ${access}` } }))).not.toBeNull()
  })

  it('odvolání zneplatní access i refresh', async () => {
    await odvolejToken(refresh)
    expect(await kontextZMcpTokenu(new Request('https://x', { headers: { authorization: `Bearer ${access}` } }))).toBeNull()
    expect(await obnovToken({ refreshToken: refresh, clientId: klient.clientId })).toMatchObject({ error: 'invalid_grant' })
  })
})
