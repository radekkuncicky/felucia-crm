import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS, type Permissions } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { GET as vykazGet, POST as vykazPost } from '@/app/api/mobile/vykaz/route'
import { PATCH as zaznamPatch, DELETE as zaznamDelete } from '@/app/api/mobile/vykaz/[id]/route'
import { GET as sazbyGet, PATCH as sazbyPatch } from '@/app/api/mobile/vykaz/sazby/route'
import { PATCH as webSazbyPatch } from '@/app/api/vykazy/sazby/route'
import { GET as webPdfGet } from '@/app/api/vykazy/[id]/pdf/route'
import { PATCH as nastaveniPatch } from '@/app/api/mobile/vykaz/nastaveni/route'
import { GET as souhrnGet } from '@/app/api/mobile/vykaz/souhrn/route'
import { POST as vyfakturovatPost } from '@/app/api/mobile/vykaz/vyfakturovat/route'
import { POST as pdfOdkazPost } from '@/app/api/mobile/vykaz/pdf-odkaz/route'
import { GET as pdfGet } from '@/app/api/vykaz/pdf/route'
import { getServerSession } from 'next-auth'
import { parseVykazVstup, signVykazPdfUrl, verifyVykazPdfSignature, souctyVykazu, prijemciVykazu, prehledTechniku } from '@/lib/vykazPrace'
import { textPripominky, sweepVykazPripominky } from '@/lib/vykazPripominka'
import { sendPushToUsers } from '@/lib/push'

const RUN = `vykaz-${Date.now()}`
const DNES = new Date().toISOString().slice(0, 10)

let orgId: string
let org2Id: string
let technikId: string
let cizíTechnikId: string
let technik2OrgId: string
let zakazkaId: string
let servisId: string
let adminId: string
let dnesZakazkaId: string

const TECHNIK_PERMS: Permissions = { ...ROLE_PRESETS.TECHNIK, servis: 'VLASTNI' }

function login(id: string, oid = orgId, perms: Permissions = TECHNIK_PERMS, role = 'TECHNIK') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId: oid, role, plan: 'PROFESSIONAL', perms } } as never)
}
const loginAdmin = () => login(adminId, orgId, ROLE_PRESETS.ADMIN, 'ADMIN')

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
  const a = await prisma.user.create({ data: { orgId, jmeno: 'Radek Vedení', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })
  adminId = a.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const z = await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-26-001`, nazev: 'Klimatizace Novák', klientId: klient.id, stav: 'V_REALIZACI', techniciRel: { create: { technikId } } },
  })
  zakazkaId = z.id
  const s = await prisma.servisniZakazka.create({ data: { orgId, cislo: `${RUN}-S-1`, typ: 'PORUCHA', popis: 'Nechladí', klientId: klient.id, technikId } as never })
  servisId = s.id
  const dnesMidnight = new Date(`${new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' })}T00:00:00.000Z`)
  const zd = await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-26-002`, nazev: 'TČ Dvořák', klientId: klient.id, stav: 'V_REALIZACI', montazOd: dnesMidnight, techniciRel: { create: { technikId } } },
  })
  dnesZakazkaId = zd.id
})

afterAll(async () => {
  for (const oid of [orgId, org2Id]) {
    await prisma.vykazPrace.deleteMany({ where: { orgId: oid } })
    await prisma.vykazFakturace.deleteMany({ where: { orgId: oid } })
    await prisma.notification.deleteMany({ where: { orgId: oid } })
    await prisma.orgSettings.deleteMany({ where: { orgId: oid } })
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

  it('chybějící sazba: částka se nepočítá, záznam se počítá do chybiSazba', () => {
    const s = souctyVykazu([
      { typ: 'VYJEZD', hodiny: 2, km: 30, sazbaHodina: null, sazbaKm: 8, castka: null },
      { typ: 'VYJEZD', hodiny: 0, km: 10, sazbaHodina: null, sazbaKm: 8, castka: null },
    ])
    expect(s).toMatchObject({ castka: 320, chybiSazba: 1 })
  })

  it('příjemci notifikace = aktivní s financeNakupky, bez autora', () => {
    const users = [
      { id: 'a', role: 'ADMIN', permissions: null },
      { id: 't', role: 'TECHNIK', permissions: null },
      { id: 'o', role: 'OBCHODNIK', permissions: null },
      { id: 'o2', role: 'OBCHODNIK', permissions: { financeNakupky: true } },
    ]
    expect(prijemciVykazu(users, 'PROFESSIONAL', 't')).toEqual(['a', 'o2'])
  })

  it('text připomínky', () => {
    const t = textPripominky([
      { typ: 'montaz', id: '1', cislo: '26-201', titulek: 'TČ', klient: 'Jan Novák' },
      { typ: 'servis', id: '2', cislo: 'S-1', titulek: 'Porucha', klient: 'Eva Dvořáková' },
    ])
    expect(t).toContain('26-201 Novák')
    expect(t).toContain('servis Eva Dvořáková')
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

  let bezSazbyId: string

  it('výjezd bez sazby projde („čeká na sazbu“), uzavřít ho ale nejde', async () => {
    login(technikId)
    const r = await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 2, km: 30 }))
    expect(r.status).toBe(201)
    const z = await r.json()
    expect(z).toMatchObject({ chybiSazba: true, castka: 0, sazbaHodina: null })
    bezSazbyId = z.id

    const f = await vyfakturovatPost(req('POST', { ids: [bezSazbyId] }))
    expect(f.status).toBe(409)
    expect((await f.json()).kod).toBe('CHYBI_SAZBY')

    const p = await vykazPost(req('POST', { zakazkaId, typ: 'POLOZKA', datum: DNES, popis: 'Měděné trubky', castka: 350.5 }))
    expect(p.status).toBe(201)
    polozkaId = (await p.json()).id
  })

  it('sazby technik v appce nemění, nastavuje je firma na webu', async () => {
    login(technikId)
    expect((await sazbyPatch(req('PATCH', { sazbaHodina: 9999 }))).status).toBe(403)
    expect((await webSazbyPatch(req('PATCH', { userId: technikId, sazbaHodina: 9999 }))).status).toBe(403)

    loginAdmin()
    expect((await webSazbyPatch(req('PATCH', { userId: technikId, sazbaHodina: -1 }))).status).toBe(400)
    expect((await webSazbyPatch(req('PATCH', { userId: technik2OrgId, sazbaHodina: 400 }))).status).toBe(404) // cizí org
    const r = await webSazbyPatch(req('PATCH', { userId: technikId, sazbaHodina: 400, sazbaKm: 8 }))
    expect(r.status).toBe(200)
    // doplní se do otevřeného výjezdu bez sazby (hodinová i km sazba)
    expect(await r.json()).toMatchObject({ sazbaHodina: 400, sazbaKm: 8, doplneno: 2 })

    login(technikId)
    expect(await (await sazbyGet(req('GET'))).json()).toEqual({ sazbaHodina: 400, sazbaKm: 8 })
    const list = await (await vykazGet(req('GET', undefined, `http://test?zakazkaId=${zakazkaId}`))).json()
    expect(list.zaznamy.find((x: { id: string }) => x.id === bezSazbyId)).toMatchObject({ castka: 1040, chybiSazba: false })
  })

  it('zápis výjezdu se snapshotem sazby', async () => {
    login(technikId)
    const r = await vykazPost(req('POST', { zakazkaId, datum: DNES, hodiny: 2.5, km: 40, poznamka: 'montáž venkovní jednotky' }))
    expect(r.status).toBe(201)
    const z = await r.json()
    expect(z).toMatchObject({ typ: 'VYJEZD', hodiny: 2.5, km: 40, sazbaHodina: 400, sazbaKm: 8, castka: 1320 })
    expect(z.zakazka).toMatchObject({ druh: 'ZAKAZKA', nazev: 'Klimatizace Novák' })
    vyjezdId = z.id

    // změna sazby firmou nepřepočítá už nasnapshotovaný záznam
    loginAdmin()
    expect(await (await webSazbyPatch(req('PATCH', { userId: technikId, sazbaHodina: 500 }))).json()).toMatchObject({ doplneno: 0 })
    login(technikId)
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
    expect(s.zaznamy).toHaveLength(4)
    expect(s.soucty).toMatchObject({ hodiny: 6, km: 80, castkaPolozky: 350.5, castka: 1040 + 1520 + 580 + 350.5, chybiSazba: 0 })
    expect(s.mesic).toMatchObject({ hodiny: 6, km: 80 })
    expect(s.pripominka).toBe(true)
    // dnešní montáž bez zápisu → „Dnes nezapsáno“; zakázka bez termínu montáže tam není
    expect(s.dnesNezapsano.map((v: { id: string }) => v.id)).toEqual([dnesZakazkaId])

    // servisní záznam zatím nevyfakturovat
    const ids = [vyjezdId, polozkaId]
    const r = await vyfakturovatPost(req('POST', { ids }))
    expect(r.status).toBe(201)
    const f = await r.json()
    expect(f).toMatchObject({ cislo: 1, hodiny: 3, km: 40, castka: 1870.5 })
    expect(f.pdfUrl).toMatch(/^\/api\/vykaz\/pdf\?/)

    // vedení dostalo info (technik sám ne)
    const notif = await prisma.notification.findMany({ where: { orgId, typ: 'VYKAZ' } })
    expect(notif.map(n => n.userId)).toEqual([adminId])
    expect(notif[0].zprava).toContain('Veči Technik uzavřel(a) výkaz práce č. 1')
    expect(notif[0].url).toBe('/vykazy')

    const s2 = await (await souhrnGet(req('GET'))).json()
    expect(s2.zaznamy.map((z: { id: string }) => z.id).sort()).toEqual([bezSazbyId, servisZaznamId].sort())
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

  it('web PDF jen s financeNakupky a jen v rámci org', async () => {
    const f = await prisma.vykazFakturace.findFirstOrThrow({ where: { userId: technikId, cislo: 1 } })
    login(technikId)
    expect((await webPdfGet(req('GET'), { params: { id: f.id } })).status).toBe(403)
    login(technik2OrgId, org2Id, ROLE_PRESETS.ADMIN, 'ADMIN')
    expect((await webPdfGet(req('GET'), { params: { id: f.id } })).status).toBe(404)
  })

  it('večerní připomínka jde vypnout', async () => {
    login(technikId)
    expect((await nastaveniPatch(req('PATCH', { pripominka: 'ne' }))).status).toBe(400)
    expect(await (await nastaveniPatch(req('PATCH', { pripominka: false }))).json()).toEqual({ pripominka: false })
    expect((await (await souhrnGet(req('GET'))).json()).pripominka).toBe(false)
  })

  it('přehled pro vedení: technik se sazbami a otevřenými záznamy', async () => {
    const users = await prisma.user.findMany({ where: { orgId, role: 'TECHNIK' }, select: { id: true, jmeno: true, aktivni: true, sazbaHodina: true, sazbaKm: true } })
    const otevrene = await prisma.vykazPrace.findMany({
      where: { orgId, fakturaceId: null },
      include: {
        zakazka: { select: { id: true, cislo: true, nazev: true } },
        servisniZakazka: { select: { id: true, cislo: true, popis: true, klient: { select: { jmeno: true, prijmeni: true } }, kontrakt: { select: { klient: { select: { jmeno: true, prijmeni: true } } } } } },
        user: { select: { id: true, jmeno: true, aktivni: true, sazbaHodina: true, sazbaKm: true } },
      },
    })
    const fakt = await prisma.vykazFakturace.findMany({ where: { orgId } })
    const p = prehledTechniku(users, otevrene, fakt)
    expect(p[0]).toMatchObject({ userId: technikId, sazbaHodina: 500, sazbaKm: 8, posledni: { cislo: 2 } })
    expect(p[0].otevreno.pocet).toBe(1)
    expect(p.find(t => t.userId === cizíTechnikId)).toMatchObject({ sazbaHodina: null, otevreno: { pocet: 0 } })
  })

  it('večerní rozeslání: push jen za dnešní výjezd bez zápisu a jen se zapnutou připomínkou', async () => {
    await prisma.user.update({ where: { id: technikId }, data: { pushToken: 'ExponentPushToken[test-vykaz]', vykazPripominka: true } })
    const pushNaMe = () => vi.mocked(sendPushToUsers).mock.calls.filter(c => c[1].includes(technikId))
    vi.mocked(sendPushToUsers).mockClear()

    await sweepVykazPripominky()
    expect(pushNaMe()).toHaveLength(1)
    expect(pushNaMe()[0][2]).toMatchObject({ title: 'Zapiš si dnešní práci', data: { type: 'vykaz' } })
    expect(pushNaMe()[0][2].body).toContain(`${RUN}-26-002`)

    // po zápisu k dnešní zakázce už nic
    login(technikId)
    expect((await vykazPost(req('POST', { zakazkaId: dnesZakazkaId, datum: new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Prague' }), hodiny: 4, km: 20 }))).status).toBe(201)
    vi.mocked(sendPushToUsers).mockClear()
    await sweepVykazPripominky()
    expect(pushNaMe()).toHaveLength(0)

    // vypnutá připomínka → nic ani bez zápisu
    await prisma.vykazPrace.deleteMany({ where: { zakazkaId: dnesZakazkaId } })
    await prisma.user.update({ where: { id: technikId }, data: { vykazPripominka: false } })
    vi.mocked(sendPushToUsers).mockClear()
    await sweepVykazPripominky()
    expect(pushNaMe()).toHaveLength(0)
  })
})
