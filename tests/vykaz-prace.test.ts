import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS, type Permissions } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { GET as vykazGet, POST as vykazPost } from '@/app/api/mobile/vykaz/route'
import { PATCH as zaznamPatch, DELETE as zaznamDelete } from '@/app/api/mobile/vykaz/[id]/route'
import { GET as sazbyGet, PATCH as sazbyPatch } from '@/app/api/mobile/vykaz/sazby/route'
import { GET as souhrnGet } from '@/app/api/mobile/vykaz/souhrn/route'
import { POST as vyfakturovatPost } from '@/app/api/mobile/vykaz/vyfakturovat/route'
import { POST as pdfOdkazPost } from '@/app/api/mobile/vykaz/pdf-odkaz/route'
import { GET as pdfGet } from '@/app/api/vykaz/pdf/route'
import { getServerSession } from 'next-auth'
import { parseVykazVstup, signVykazPdfUrl, verifyVykazPdfSignature, souctyVykazu } from '@/lib/vykazPrace'

const RUN = `vykaz-${Date.now()}`
const DNES = new Date().toISOString().slice(0, 10)

let orgId: string
let org2Id: string
let technikId: string
let cizíTechnikId: string
let technik2OrgId: string
let zakazkaId: string
let servisId: string

const TECHNIK_PERMS: Permissions = { ...ROLE_PRESETS.TECHNIK, servis: 'VLASTNI' }

function login(id: string, oid = orgId, perms: Permissions = TECHNIK_PERMS) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId: oid, role: 'TECHNIK', plan: 'PROFESSIONAL', perms } } as never)
}

const req = (method: string, body?: unknown, url = 'http://test') =>
  new Request(url, { method, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Výkaz', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const org2 = await prisma.organization.create({ data: { nazev: 'Test Výkaz 2', slug: `${RUN}-2`, plan: 'PROFESSIONAL' } })
  org2Id = org2.id
  const t = await prisma.user.create({ data: { orgId, jmeno: 'Veči Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  technikId = t.id
  const t2 = await prisma.user.create({ data: { orgId, jmeno: 'Cizí Technik', email: `${RUN}-t2@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  cizíTechnikId = t2.id
  const t3 = await prisma.user.create({ data: { orgId: org2Id, jmeno: 'Jiná Org', email: `${RUN}-t3@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  technik2OrgId = t3.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const z = await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-26-001`, nazev: 'Klimatizace Novák', klientId: klient.id, stav: 'V_REALIZACI', techniciRel: { create: { technikId } } },
  })
  zakazkaId = z.id
  const s = await prisma.servisniZakazka.create({ data: { orgId, cislo: `${RUN}-S-1`, typ: 'PORUCHA', popis: 'Nechladí', klientId: klient.id, technikId } as never })
  servisId = s.id
})

afterAll(async () => {
  for (const oid of [orgId, org2Id]) {
    await prisma.vykazPrace.deleteMany({ where: { orgId: oid } })
    await prisma.vykazFakturace.deleteMany({ where: { orgId: oid } })
    await prisma.servisniZakazka.deleteMany({ where: { orgId: oid } })
    await prisma.zakazka.deleteMany({ where: { orgId: oid } })
    await prisma.client.deleteMany({ where: { orgId: oid } })
    await prisma.user.deleteMany({ where: { orgId: oid } })
    await prisma.organization.delete({ where: { id: oid } })
  }
})

describe('validace a výpočty', () => {
  it('parseVykazVstup', () => {
    expect(parseVykazVstup({ datum: DNES, hodiny: 2.5, km: 40 })).toMatchObject({ typ: 'VYJEZD', hodiny: 2.5, km: 40 })
    expect(parseVykazVstup({ datum: DNES, hodiny: 2.3, km: 0 })).toBe('Hodiny zadávej po čtvrthodinách')
    expect(parseVykazVstup({ datum: DNES, hodiny: 0, km: 0 })).toBe('Zadej hodiny nebo kilometry')
    expect(parseVykazVstup({ datum: '2099-01-01', hodiny: 1 })).toBe('Neplatné datum')
    expect(parseVykazVstup({ typ: 'POLOZKA', datum: DNES, castka: 500 })).toBe('Popis položky je povinný')
    expect(parseVykazVstup({ typ: 'POLOZKA', datum: DNES, popis: 'Měděné trubky', castka: 0 })).toBe('Neplatná částka')
  })

  it('součty', () => {
    const s = souctyVykazu([
      { typ: 'VYJEZD', hodiny: 2.5, km: 40, sazbaHodina: 400, sazbaKm: 8, castka: null },
      { typ: 'POLOZKA', hodiny: 0, km: 0, sazbaHodina: null, sazbaKm: null, castka: 350.5 },
    ])
    expect(s).toMatchObject({ hodiny: 2.5, km: 40, castkaHodiny: 1000, castkaKm: 320, castkaPolozky: 350.5, castka: 1670.5 })
  })

  it('podpis PDF odkazu', () => {
    const url = new URL(signVykazPdfUrl('u1', 'f1'), 'http://x')
    const p = url.searchParams
    expect(verifyVykazPdfSignature(p.get('u'), p.get('f'), p.get('exp'), p.get('sig'))).toBe(true)
    expect(verifyVykazPdfSignature('u2', p.get('f'), p.get('exp'), p.get('sig'))).toBe(false)
    expect(verifyVykazPdfSignature(p.get('u'), 'f2', p.get('exp'), p.get('sig'))).toBe(false)
    expect(verifyVykazPdfSignature(p.get('u'), p.get('f'), p.get('exp'), p.get('sig'), Date.now() + 3600_000)).toBe(false)
  })
})

describe('API výkazu', () => {
  let vyjezdId: string
  let polozkaId: string
  let servisZaznamId: string

  it('výjezd bez nastavených sazeb → 400 CHYBI_SAZBY, položka projde', async () => {
    login(technikId)
    const r = await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 2, km: 30 }))
    expect(r.status).toBe(400)
    expect((await r.json()).kod).toBe('CHYBI_SAZBY')

    const p = await vykazPost(req('POST', { zakazkaId, typ: 'POLOZKA', datum: DNES, popis: 'Měděné trubky', castka: 350.5 }))
    expect(p.status).toBe(201)
    polozkaId = (await p.json()).id
  })

  it('nastavení sazeb a zápis výjezdu se snapshotem', async () => {
    login(technikId)
    expect((await sazbyPatch(req('PATCH', { sazbaHodina: 400, sazbaKm: 8 }))).status).toBe(200)
    expect(await (await sazbyGet(req('GET'))).json()).toEqual({ sazbaHodina: 400, sazbaKm: 8 })
    expect((await sazbyPatch(req('PATCH', { sazbaHodina: -1 }))).status).toBe(400)

    const r = await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 2.5, km: 40, poznamka: 'montáž venkovní jednotky' }))
    expect(r.status).toBe(201)
    const z = await r.json()
    expect(z).toMatchObject({ typ: 'VYJEZD', hodiny: 2.5, km: 40, sazbaHodina: 400, sazbaKm: 8, castka: 1320 })
    expect(z.zakazka).toMatchObject({ druh: 'ZAKAZKA', nazev: 'Klimatizace Novák' })
    vyjezdId = z.id

    // změna sazby nepřepočítá starý záznam
    await sazbyPatch(req('PATCH', { sazbaHodina: 500 }))
    const list = await (await vykazGet(req('GET', undefined, `http://test?zakazkaId=${zakazkaId}`))).json()
    expect(list.zaznamy.find((x: { id: string }) => x.id === vyjezdId).castka).toBe(1320)
  })

  it('servisní výjezd', async () => {
    login(technikId)
    const r = await vykazPost(req('POST', { servisniZakazkaId: servisId, datum: DNES, hodiny: 1, km: 10 }))
    expect(r.status).toBe(201)
    const z = await r.json()
    expect(z.zakazka.druh).toBe('SERVIS')
    expect(z.castka).toBe(580)
    servisZaznamId = z.id
  })

  it('cíl: právě jedno, a jen v rozsahu technika', async () => {
    login(technikId)
    expect((await vykazPost(req('POST', { datum: DNES, hodiny: 1 }))).status).toBe(400)
    expect((await vykazPost(req('POST', { zakazkaId, servisniZakazkaId: servisId, datum: DNES, hodiny: 1 }))).status).toBe(400)

    login(cizíTechnikId)
    expect((await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 1, km: 0 }))).status).toBe(403)
    expect((await vykazPost(req('POST', { servisniZakazkaId: servisId, datum: DNES, hodiny: 1 }))).status).toBe(403)
    // cizí záznam nejde upravit ani smazat
    expect((await zaznamPatch(req('PATCH', { datum: DNES, hodiny: 8 }), { params: { id: vyjezdId } })).status).toBe(404)
    expect((await zaznamDelete(req('DELETE'), { params: { id: vyjezdId } })).status).toBe(404)

    login(technik2OrgId, org2Id)
    expect((await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 1 }))).status).toBe(403)
    const s = await (await souhrnGet(req('GET'))).json()
    expect(s.zaznamy).toHaveLength(0)
  })

  it('úprava vlastního nevyfakturovaného záznamu', async () => {
    login(technikId)
    const r = await zaznamPatch(req('PATCH', { datum: DNES, hodiny: 3, km: 40 }), { params: { id: vyjezdId } })
    expect(r.status).toBe(200)
    expect((await r.json()).castka).toBe(1520) // 3 × 400 (sazba ze zápisu) + 40 × 8
  })

  it('souhrn → vyfakturovat jen předaná ids → zamčeno', async () => {
    login(technikId)
    const s = await (await souhrnGet(req('GET'))).json()
    expect(s.zaznamy).toHaveLength(3)
    expect(s.soucty).toMatchObject({ hodiny: 4, km: 50, castkaPolozky: 350.5, castka: 1520 + 580 + 350.5 })

    // servisní záznam zatím nevyfakturovat
    const ids = [vyjezdId, polozkaId]
    const r = await vyfakturovatPost(req('POST', { ids }))
    expect(r.status).toBe(201)
    const f = await r.json()
    expect(f).toMatchObject({ cislo: 1, hodiny: 3, km: 40, castka: 1870.5 })
    expect(f.pdfUrl).toMatch(/^\/api\/vykaz\/pdf\?/)

    const s2 = await (await souhrnGet(req('GET'))).json()
    expect(s2.zaznamy.map((z: { id: string }) => z.id)).toEqual([servisZaznamId])
    expect(s2.fakturace).toHaveLength(1)

    expect((await zaznamPatch(req('PATCH', { datum: DNES, hodiny: 8 }), { params: { id: vyjezdId } })).status).toBe(409)
    expect((await zaznamDelete(req('DELETE'), { params: { id: polozkaId } })).status).toBe(409)
    // opakované vyfakturování týchž ids
    expect((await vyfakturovatPost(req('POST', { ids }))).status).toBe(409)

    const r2 = await vyfakturovatPost(req('POST', { ids: [servisZaznamId] }))
    expect((await r2.json()).cislo).toBe(2)
  })

  it('PDF odkaz jen na vlastní fakturaci; PDF route ověřuje podpis', async () => {
    login(technikId)
    const f = await prisma.vykazFakturace.findFirstOrThrow({ where: { userId: technikId, cislo: 1 } })
    const r = await pdfOdkazPost(req('POST', { fakturaceId: f.id }))
    expect(r.status).toBe(200)
    const { url } = await r.json()
    expect(url).toMatch(/^\/api\/vykaz\/pdf\?/)

    login(cizíTechnikId)
    expect((await pdfOdkazPost(req('POST', { fakturaceId: f.id }))).status).toBe(404)

    // zfalšovaný podpis / cizí uživatel v odkazu
    const u = new URL(url, 'http://test')
    u.searchParams.set('u', cizíTechnikId)
    expect((await pdfGet(new Request(u.toString()))).status).toBe(403)
  })
})
