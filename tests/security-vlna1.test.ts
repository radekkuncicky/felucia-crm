import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import fs from 'fs'
import path from 'path'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { GET as uploadsGet } from '@/app/api/uploads/[...path]/route'
import { POST as dealsPost } from '@/app/api/deals/route'
import { POST as kontraktyPost } from '@/app/api/servis/kontrakty/route'
import { POST as zarizeniPost } from '@/app/api/servis/zarizeni/route'
import { PATCH as quotePatch, DELETE as quoteDelete } from '@/app/api/deals/[id]/quotes/[quoteId]/route'
import { POST as dealItemsPost } from '@/app/api/deals/[id]/items/route'
import { signUploadUrl, verifyUploadSignature } from '@/lib/uploadSign'
import { isSessionValid, loadPermsSnapshot, bumpSessionVersion, invalidatePermsCache } from '@/lib/permsSnapshot'
import { getMobileSession } from '@/lib/mobile-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'

/**
 * Regresní testy k bezpečnostnímu auditu 2026-09, vlna 1: SEC-04 (rate-limit
 * loginu), SEC-05 (zneplatnění session), SEC-08/15 (FK z těla requestu),
 * SEC-09 (rozsah OP v pod-routes), SEC-10 (/uploads přes handler s auth).
 */

const RUN = `sec1-${Date.now()}`
const UPLOADS = path.join(process.cwd(), 'public', 'uploads')
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])

let orgA: string, orgB: string
let adminA: string, obchodnikA: string, technikA: string
let clientA: string, clientB: string
let zakazkaA: string
let dealA: string, dealOfObchodnik: string, quoteA: string
let templateB: string
const createdFiles: string[] = []

function login(id: string, orgId: string, role: 'ADMIN' | 'OBCHODNIK' | 'TECHNIK', perms?: Record<string, unknown>) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId, role, plan: 'PROFESSIONAL', perms } } as never)
}
function logout() { vi.mocked(getServerSession).mockResolvedValue(null as never) }

function json(body: unknown, method = 'POST') {
  return new Request('http://test', { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

function writeUpload(rel: string) {
  const abs = path.join(UPLOADS, rel)
  fs.mkdirSync(path.dirname(abs), { recursive: true })
  fs.writeFileSync(abs, PNG)
  createdFiles.push(abs)
  return '/uploads/' + rel
}

function getUpload(rel: string, headers: Record<string, string> = {}) {
  const url = new URL('http://test/api' + rel)
  const segments = url.pathname.replace('/api/uploads/', '').split('/')
  return uploadsGet(new NextRequest(url, { headers }), { params: { path: segments } })
}

beforeAll(async () => {
  const a = await prisma.organization.create({ data: { nazev: 'Sec1 A', slug: `${RUN}-a`, plan: 'PROFESSIONAL' } })
  const b = await prisma.organization.create({ data: { nazev: 'Sec1 B', slug: `${RUN}-b`, plan: 'PROFESSIONAL' } })
  orgA = a.id; orgB = b.id
  const hesloHash = await bcrypt.hash('Heslo12345', 4)
  adminA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Admin A', email: `${RUN}-admin@a.cz`, hesloHash, role: 'ADMIN' } })).id
  obchodnikA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Obchodník A', email: `${RUN}-obch@a.cz`, hesloHash, role: 'OBCHODNIK' } })).id
  technikA = (await prisma.user.create({ data: { orgId: orgA, jmeno: 'Technik A', email: `${RUN}-tech@a.cz`, hesloHash, role: 'TECHNIK' } })).id
  clientA = (await prisma.client.create({ data: { orgId: orgA, jmeno: 'Klient', prijmeni: 'A' } })).id
  clientB = (await prisma.client.create({ data: { orgId: orgB, jmeno: 'Klient', prijmeni: 'B' } })).id
  zakazkaA = (await prisma.zakazka.create({ data: { orgId: orgA, cislo: `${RUN}-Z1`, nazev: 'Z', klientId: clientA, vedouciId: adminA, stav: 'V_REALIZACI' } })).id
  dealA = (await prisma.deal.create({ data: { orgId: orgA, clientId: clientA, userId: adminA, technologie: 'KLIMA', kod: `${RUN}-OP1` } })).id
  dealOfObchodnik = (await prisma.deal.create({ data: { orgId: orgA, clientId: clientA, userId: obchodnikA, technologie: 'KLIMA', kod: `${RUN}-OP2` } })).id
  quoteA = (await prisma.quote.create({ data: { dealId: dealA, orgId: orgA, nazev: 'Nabídka', kod: `${RUN}-NAB1` } })).id
  templateB = (await prisma.quoteTemplate.create({ data: { orgId: orgB, nazev: 'Šablona B', typ: 'BASE' } })).id
})

afterAll(async () => {
  for (const f of createdFiles) fs.rmSync(f, { force: true })
  for (const dir of [path.join(UPLOADS, 'zakazky', zakazkaA), path.join(UPLOADS, orgA), path.join(UPLOADS, orgB), path.join(UPLOADS, 'org', orgA), path.join(UPLOADS, 'org', orgB)]) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
  for (const orgId of [orgA, orgB]) {
    await prisma.auditLog.deleteMany({ where: { orgId } })
    await prisma.notification.deleteMany({ where: { orgId } })
    await prisma.quoteItem.deleteMany({ where: { deal: { orgId } } })
    await prisma.quote.deleteMany({ where: { orgId } })
    await prisma.servisniZakazka.deleteMany({ where: { orgId } })
    await prisma.servisniKontrakt.deleteMany({ where: { orgId } })
    await prisma.zarizeni.deleteMany({ where: { orgId } })
    await prisma.deal.deleteMany({ where: { orgId } })
    await prisma.zakazka.deleteMany({ where: { orgId } })
    await prisma.quoteTemplate.deleteMany({ where: { orgId } })
    await prisma.client.deleteMany({ where: { orgId } })
    await prisma.user.deleteMany({ where: { orgId } })
    await prisma.orgSettings.deleteMany({ where: { orgId } })
    await prisma.organization.delete({ where: { id: orgId } })
  }
})

describe('SEC-10 — /uploads přes handler s autorizací', () => {
  it('bez session → 401; cizí org → 403; vlastní → 200 s CSP sandbox', async () => {
    const relA = writeUpload(`zakazky/${zakazkaA}/1.png`)
    logout()
    expect((await getUpload(relA)).status).toBe(401)

    login(adminA, orgB, 'ADMIN')
    expect((await getUpload(relA)).status).toBe(403)

    login(adminA, orgA, 'ADMIN')
    const ok = await getUpload(relA)
    expect(ok.status).toBe(200)
    expect(ok.headers.get('content-type')).toBe('image/png')
    expect(ok.headers.get('content-security-policy')).toContain('sandbox')
    expect(Buffer.from(await ok.arrayBuffer()).equals(PNG)).toBe(true)
  })

  it('dokumenty a fotky OP jsou vázané na orgId v cestě', async () => {
    const relDoc = writeUpload(`${orgA}/documents/abc.png`)
    login(adminA, orgB, 'ADMIN')
    expect((await getUpload(relDoc)).status).toBe(403)
    login(adminA, orgA, 'ADMIN')
    expect((await getUpload(relDoc)).status).toBe(200)
  })

  it('TECHNIK bez rozsahu na zakázku fotku nedostane', async () => {
    const rel = writeUpload(`zakazky/${zakazkaA}/2.png`)
    login(technikA, orgA, 'TECHNIK') // preset TECHNIK: jen přiřazené zakázky, tenhle není přiřazen
    expect((await getUpload(rel)).status).toBe(403)
  })

  it('logo org je veřejné (login stránka tenanta), příloha VOP ne', async () => {
    const logo = writeUpload(`org/${orgA}/logo.png`)
    const vop = writeUpload(`org/${orgA}/priloha-vop.png`)
    logout()
    expect((await getUpload(logo)).status).toBe(200)
    expect((await getUpload(vop)).status).toBe(401)
  })

  it('podepsaný odkaz funguje bez session, po expiraci a s cizím podpisem ne', async () => {
    const rel = writeUpload(`zakazky/${zakazkaA}/3.png`)
    logout()
    const signed = signUploadUrl(rel)
    expect(signed).toMatch(/\?exp=\d+&sig=[A-Za-z0-9_-]+$/)
    expect((await getUpload(signed)).status).toBe(200)

    const expired = signUploadUrl(rel, -10)
    expect((await getUpload(expired)).status).toBe(401)

    const other = signUploadUrl(`/uploads/zakazky/${zakazkaA}/jiny.png`).split('?')[1]
    expect((await getUpload(rel + '?' + other)).status).toBe(401)
    expect(verifyUploadSignature(rel, '99999999999', 'x')).toBe(false)
  })

  it('traversal a nepovolené přípony → 404', async () => {
    login(adminA, orgA, 'ADMIN')
    expect((await getUpload('/uploads/../.env')).status).toBe(404)
    expect((await getUpload('/uploads/zakazky/' + zakazkaA + '/x.html')).status).toBe(404)
  })
})

describe('SEC-05 — session přestane platit', () => {
  it('deaktivace uživatele / org a změna hesla (sessionVersion) zneplatní snapshot', async () => {
    const u = await prisma.user.create({ data: { orgId: orgA, jmeno: 'Dočasný', email: `${RUN}-tmp@a.cz`, hesloHash: 'x', role: 'TECHNIK' } })
    let snap = await loadPermsSnapshot(u.id)
    expect(isSessionValid(snap, 0)).toBe(true)
    expect(isSessionValid(snap, undefined)).toBe(true) // starý token bez verze

    await bumpSessionVersion(u.id)
    snap = await loadPermsSnapshot(u.id)
    expect(isSessionValid(snap, 0)).toBe(false)
    expect(isSessionValid(snap, 1)).toBe(true)

    await prisma.user.update({ where: { id: u.id }, data: { aktivni: false } })
    invalidatePermsCache(u.id)
    expect(isSessionValid(await loadPermsSnapshot(u.id), 1)).toBe(false)

    await prisma.user.update({ where: { id: u.id }, data: { aktivni: true } })
    await prisma.organization.update({ where: { id: orgA }, data: { aktivni: false } })
    invalidatePermsCache(u.id)
    expect(isSessionValid(await loadPermsSnapshot(u.id), 1)).toBe(false)
    await prisma.organization.update({ where: { id: orgA }, data: { aktivni: true } })
    invalidatePermsCache(u.id)
    await prisma.user.delete({ where: { id: u.id } })
  })

  it('jwt callback vyhodí SESSION_INVALID pro deaktivovaného uživatele', async () => {
    const u = await prisma.user.create({ data: { orgId: orgA, jmeno: 'Deakt', email: `${RUN}-deakt@a.cz`, hesloHash: 'x', role: 'TECHNIK', aktivni: false } })
    const jwt = authOptions.callbacks!.jwt!
    const token = { id: u.id, orgId: orgA, role: 'TECHNIK', perms: getPerms({ role: 'TECHNIK' } as never), permsAt: 0, sv: 0 }
    await expect(jwt({ token, user: undefined as never, account: null, trigger: undefined } as never)).rejects.toThrow('SESSION_INVALID')
    await prisma.user.delete({ where: { id: u.id } })
  })

  it('mobilní token se starou sessionVersion je odmítnut', async () => {
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)
    const mk = (sv: number) => new SignJWT({ userId: technikA, orgId: orgA, orgSlug: 'x', role: 'TECHNIK', plan: 'PROFESSIONAL', sv })
      .setProtectedHeader({ alg: 'HS256' }).setExpirationTime('1h').sign(secret)
    invalidatePermsCache(technikA)
    const req = async (sv: number) => getMobileSession(new Request('http://test', { headers: { authorization: 'Bearer ' + await mk(sv) } }))
    expect(await req(0)).not.toBeNull()
    expect(await req(5)).toBeNull()
  })
})

describe('SEC-04 — rate-limit loginu', () => {
  it('po 10 pokusech na jeden e-mail vrátí RATE_LIMITED', async () => {
    const provider = authOptions.providers[0] as unknown as { options: { authorize: (c: Record<string, string>, r: unknown) => Promise<unknown> } }
    const authorize = provider.options.authorize
    const req = { headers: { 'x-real-ip': `10.0.0.${Math.floor(Math.random() * 250)}` } }
    const email = `${RUN}-rl@a.cz`
    for (let i = 0; i < 10; i++) {
      expect(await authorize({ email, password: 'spatne' }, req)).toBeNull()
    }
    await expect(authorize({ email, password: 'spatne' }, req)).rejects.toThrow('RATE_LIMITED')
  })
})

describe('SEC-08/15 — cizí ID v těle requestu', () => {
  it('POST /api/deals s clientId jiné org → 404', async () => {
    login(adminA, orgA, 'ADMIN')
    const res = await dealsPost(json({ clientId: clientB, technologie: 'KLIMA' }))
    expect(res.status).toBe(404)
    expect(await prisma.deal.count({ where: { orgId: orgA, clientId: clientB } })).toBe(0)
  })

  it('POST /api/servis/kontrakty a /api/servis/zarizeni s klientId jiné org → 404', async () => {
    login(adminA, orgA, 'ADMIN')
    const k = await kontraktyPost(json({ klientId: clientB, nazev: 'K', typ: 'ROCNI', intervalMesicu: 12, zacatek: '2026-01-01' }))
    expect(k.status).toBe(404)
    const z = await zarizeniPost(json({ klientId: clientB, nazev: 'Jednotka' }))
    expect(z.status).toBe(404)
    expect(await prisma.servisniKontrakt.count({ where: { klientId: clientB } })).toBe(0)
    expect(await prisma.zarizeni.count({ where: { klientId: clientB } })).toBe(0)
  })

  it('templateId jiné org se neuloží; productId jiné org se nenaváže', async () => {
    login(adminA, orgA, 'ADMIN')
    const res = await quotePatch(json({ templateId: templateB }, 'PATCH'), { params: { id: dealA, quoteId: quoteA } })
    expect(res.status).toBe(404)

    const productB = await prisma.product.create({ data: { orgId: orgB, nazev: 'Produkt B', kod: `${RUN}-PB`, standardniCena: 100, jednotka: 'ks' } })
    const item = await dealItemsPost(json({ productId: productB.id, nazev: 'X', mnozstvi: 1, cenaZaKus: 10 }), { params: { id: dealA } })
    expect(item.status).toBe(201)
    expect((await item.json()).productId).toBeNull()
    await prisma.product.delete({ where: { id: productB.id } })
  })
})

describe('SEC-09 — rozsah OP v pod-routes', () => {
  it('TECHNIK (bez obchodu) nemůže mazat nabídku; OBCHODNIK bez obchodCiziOP jen na svých OP', async () => {
    login(technikA, orgA, 'TECHNIK')
    expect((await quoteDelete(new Request('http://test', { method: 'DELETE' }), { params: { id: dealA, quoteId: quoteA } })).status).toBe(403)

    // Preset OBCHODNIK má obchodCiziOP: true — testujeme per-user přepis „jen vlastní OP"
    const jenVlastni = { ...getPerms({ role: 'OBCHODNIK' } as never), obchodCiziOP: false }
    login(obchodnikA, orgA, 'OBCHODNIK', jenVlastni)
    expect(await canAccessDeal({ id: obchodnikA, orgId: orgA }, jenVlastni, dealA)).toBe(false)
    expect(await canAccessDeal({ id: obchodnikA, orgId: orgA }, jenVlastni, dealOfObchodnik)).toBe(true)
    expect((await quotePatch(json({ nazev: 'Hack' }, 'PATCH'), { params: { id: dealA, quoteId: quoteA } })).status).toBe(403)

    login(adminA, orgA, 'ADMIN')
    expect((await quotePatch(json({ nazev: 'OK' }, 'PATCH'), { params: { id: dealA, quoteId: quoteA } })).status).toBe(200)
    expect(await prisma.quote.count({ where: { id: quoteA } })).toBe(1)
  })
})
