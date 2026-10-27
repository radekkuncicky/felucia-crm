import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/email', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/email')>()),
  isEmailConfigured: () => true,
  sendEmail: vi.fn(async () => undefined),
}))

import { getServerSession } from 'next-auth'
import { sendEmail } from '@/lib/email'
import { POST as vydejPost } from '@/app/api/sklad/vydej/route'
import { PUT as nastaveniPut } from '@/app/api/kpi/nastaveni/route'
import { stavProduktu } from '@/lib/sklad'
import { ROLE_PRESETS, resolvePermissions } from '@/lib/permissions'
import { navFlags } from '@/lib/navigation'
import { semafor } from '@/lib/kpi/semafor'
import { mesicKlic, mesicRozsah, mesiceTrendu } from '@/lib/kpi/obdobi'
import { kpiDetail, kpiPrehled, kpiPristup, formatKpi } from '@/lib/kpi'
import { sweepKpiTydenniSouhrn, TYP_KPI_SOUHRN } from '@/worker/kpiSouhrn'

/** KPI vedení, fáze 1 (docs/kpi-vedeni/01-specifikace.md) */

const RUN = `kpi-${Date.now()}`
const ZARI = new Date('2026-09-15T10:00:00Z')

let orgId: string
let ciziOrgId: string
let jednatelId: string
let adminId: string
let productId: string

function loginAs(userId: string, org: string, role: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role } } as never)
}
const req = (method: string, body: unknown) => new Request('http://test', { method, body: JSON.stringify(body) })

async function zalozOrg(slug: string, modulKpi: boolean) {
  const org = await prisma.organization.create({ data: { nazev: `Test ${slug}`, slug } })
  await prisma.orgSettings.create({ data: { orgId: org.id, modulKpi } })
  const technik = await prisma.user.create({ data: { orgId: org.id, jmeno: 'Technik', email: `${slug}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  const klient = await prisma.client.create({ data: { orgId: org.id, jmeno: 'Karel', prijmeni: 'Klient' } })
  const opUspech = await prisma.deal.create({ data: { orgId: org.id, clientId: klient.id, predmet: 'TČ', kod: `${slug}-op1`, technologie: 'TEPELNE_CERPADLO', stav: 'USPECH' } })
  const opPas = await prisma.deal.create({ data: { orgId: org.id, clientId: klient.id, predmet: 'Klima', kod: `${slug}-op2`, technologie: 'KLIMA', stav: 'PAS' } })
  // září: 3 leady — vyhraný, prohraný, nepřevedený → konverze 1/3
  await prisma.lead.create({ data: { orgId: org.id, jmeno: 'Lead výhra', vytvoreno: ZARI, prevedenNaOpId: opUspech.id, status: 'PREVEDEN' } })
  await prisma.lead.create({ data: { orgId: org.id, jmeno: 'Lead prohra', vytvoreno: ZARI, prevedenNaOpId: opPas.id, status: 'PREVEDEN' } })
  await prisma.lead.create({ data: { orgId: org.id, jmeno: 'Lead nic', vytvoreno: ZARI } })
  const zakazka = await prisma.zakazka.create({ data: { orgId: org.id, cislo: `${slug}-Z1`, nazev: 'Montáž TČ', klientId: klient.id, opId: opUspech.id, hlavniTechnikId: technik.id } })
  await prisma.predavak.create({ data: { orgId: org.id, zakazkaId: zakazka.id, cislo: `${slug}-PP1`, technikId: technik.id, stav: 'PODPISAN', podpisano: ZARI } })
  return org.id
}

beforeAll(async () => {
  orgId = await zalozOrg(RUN, true)
  ciziOrgId = await zalozOrg(`${RUN}-cizi`, false)
  // cizí org má navíc vyhraný lead — do KPI první org se nesmí dostat
  const ciziOp = await prisma.deal.findFirstOrThrow({ where: { orgId: ciziOrgId, stav: 'PAS' } })
  await prisma.deal.update({ where: { id: ciziOp.id }, data: { stav: 'USPECH' } })

  jednatelId = (await prisma.user.create({ data: { orgId, jmeno: 'Jana Jednatelka', email: `${RUN}-j@example.com`, hesloHash: 'x', role: 'JEDNATEL' } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Adam Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  await prisma.user.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí jednatel', email: `${RUN}-cj@example.com`, hesloHash: 'x', role: 'JEDNATEL' } })

  productId = (await prisma.product.create({ data: { orgId, kod: 'TR-01', nazev: 'Trubka Cu', standardniCena: 200, nakladovaCena: 100 } })).id
  await prisma.skladPohyb.create({ data: { orgId, typ: 'PRIJEM_SKLAD', productId, nazev: 'Trubka Cu', mnozstvi: 10, nakupniCena: 100, vytvorilId: adminId } })
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.notification.deleteMany({ where: { orgId: org } })
    await prisma.auditLog.deleteMany({ where: { orgId: org } })
    await prisma.kpiNastaveni.deleteMany({ where: { orgId: org } })
    await prisma.skladPohyb.deleteMany({ where: { orgId: org } })
    await prisma.product.deleteMany({ where: { orgId: org } })
    await prisma.predavak.deleteMany({ where: { orgId: org } })
    await prisma.zakazka.deleteMany({ where: { orgId: org } })
    await prisma.lead.deleteMany({ where: { orgId: org } })
    await prisma.deal.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.orgSettings.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } })
  }
})

describe('semafor (oranžová = do 10 % od cíle, relativně)', () => {
  it('vyšší je lepší', () => {
    expect(semafor(36, 35, 'VYSSI')).toBe('ZELENA')
    expect(semafor(31.5, 35, 'VYSSI')).toBe('ORANZOVA')
    expect(semafor(31.4, 35, 'VYSSI')).toBe('CERVENA')
  })
  it('nižší je lepší', () => {
    expect(semafor(1, 1, 'NIZSI')).toBe('ZELENA')
    expect(semafor(1.1, 1, 'NIZSI')).toBe('ORANZOVA')
    expect(semafor(1.2, 1, 'NIZSI')).toBe('CERVENA')
  })
  it('cíl 0 = jen zelená/červená, bez dat nikdy zelená', () => {
    expect(semafor(0, 0, 'NIZSI')).toBe('ZELENA')
    expect(semafor(0.5, 0, 'NIZSI')).toBe('CERVENA')
    expect(semafor(null, 35, 'VYSSI')).toBe('BEZ_DAT')
    expect(semafor(10, null, 'VYSSI')).toBe('BEZ_CILE')
  })
})

describe('období v pražském čase', () => {
  it('půlnoc 1. 10. SELČ patří do října', () => {
    expect(mesicKlic(new Date('2026-09-30T22:30:00Z'))).toBe('2026-10')
    expect(mesicKlic(new Date('2026-09-30T21:30:00Z'))).toBe('2026-09')
  })
  it('rozsah měsíce přes konec letního času', () => {
    const r = mesicRozsah('2026-10')
    expect(r.od.toISOString()).toBe('2026-09-30T22:00:00.000Z')
    expect(r.do.toISOString()).toBe('2026-10-31T23:00:00.000Z')
  })
  it('trend začíná nejdřív lednem 2026', () => {
    expect(mesiceTrendu(new Date('2026-03-10T12:00:00Z'))).toEqual(['2026-01', '2026-02', '2026-03'])
    expect(mesiceTrendu(new Date('2027-06-10T12:00:00Z'))).toHaveLength(12)
  })
})

describe('role Jednatel a oprávnění kpi', () => {
  it('Jednatel = vše jako Správce + kpi; ostatní role kpi nemají', () => {
    expect(ROLE_PRESETS.JEDNATEL).toEqual({ ...ROLE_PRESETS.ADMIN, kpi: true })
    for (const r of ['ADMIN', 'MANAZER', 'OBCHODNIK', 'HLAVNI_TECHNIK', 'TECHNIK'] as const) {
      expect(ROLE_PRESETS[r].kpi).toBe(false)
    }
  })
  it('kpi jde správci přidělit přepisem', () => {
    expect(resolvePermissions('ADMIN', { kpi: true }, 'ENTERPRISE').kpi).toBe(true)
  })
  it('menu ukáže KPI jen se zapnutým modulem', () => {
    const perms = ROLE_PRESETS.JEDNATEL
    expect(navFlags({ perms, plan: 'ENTERPRISE', orgSettings: { modulKpi: true } }).kpi).toBe(true)
    expect(navFlags({ perms, plan: 'ENTERPRISE', orgSettings: { modulKpi: false } }).kpi).toBe(false)
    expect(navFlags({ perms: ROLE_PRESETS.ADMIN, plan: 'ENTERPRISE', orgSettings: { modulKpi: true } }).kpi).toBe(false)
  })
  it('kpiPristup hlídá modul i oprávnění', async () => {
    expect(await kpiPristup(orgId, ROLE_PRESETS.JEDNATEL)).toBe(true)
    expect(await kpiPristup(orgId, ROLE_PRESETS.ADMIN)).toBe(false)
    expect(await kpiPristup(ciziOrgId, ROLE_PRESETS.JEDNATEL)).toBe(false)
  })
})

describe('výdej ze skladu bez zakázky', () => {
  it('bez kategorie nebo důvodu neprojde, víc než dostupné taky ne', async () => {
    loginAs(adminId, orgId, 'ADMIN')
    expect((await vydejPost(req('POST', { productId, mnozstvi: 1, duvod: 'x' }))).status).toBe(400)
    expect((await vydejPost(req('POST', { productId, mnozstvi: 1, kategorie: 'JINE' }))).status).toBe(400)
    expect((await vydejPost(req('POST', { productId, mnozstvi: 11, kategorie: 'JINE', duvod: 'x' }))).status).toBe(400)
  })
  it('technik bez skladu PLNY nesmí', async () => {
    loginAs(adminId, orgId, 'TECHNIK')
    expect((await vydejPost(req('POST', { productId, mnozstvi: 1, kategorie: 'JINE', duvod: 'x' }))).status).toBe(403)
  })
  it('vydá z dostupného a nečerpá rezervaci', async () => {
    loginAs(adminId, orgId, 'ADMIN')
    const r1 = await vydejPost(req('POST', { productId, mnozstvi: 2, kategorie: 'JINE', duvod: 'vzorek pro klienta' }))
    expect(r1.status).toBe(201)
    const r2 = await vydejPost(req('POST', { productId, mnozstvi: 1, kategorie: 'PROVOZNI_SPOTREBA', duvod: 'dílna' }))
    expect(r2.status).toBe(201)
    expect(await stavProduktu(orgPrisma(orgId), orgId, productId)).toEqual({ naSklade: 7, rezervovano: 0, dostupne: 7 })
  })
})

describe('výpočty KPI fáze 1', () => {
  const ted = new Date()
  const mesic = mesicKlic(ted)

  it('konverze = vyhrané OP / leady podle měsíce vzniku, jen vlastní org', async () => {
    const k = await kpiDetail(orgId, 'KONVERZE', '2026-09')
    const zari = k.trend.find(b => b.klic === '2026-09')
    expect(zari?.hodnota).toBe(33.3)
    expect(zari?.detail).toBe('1 z 3')
    expect(k.zaznamy.map(z => z.titulek).sort()).toEqual(['Lead nic', 'Lead prohra'])
  })

  it('materiál bez zakázky: jen výdeje mimo provozní spotřebu, v Kč', async () => {
    const k = await kpiDetail(orgId, 'MATERIAL_BEZ_ZAKAZKY', mesic)
    expect(k.prubezne).toBe(200)
    expect(k.zaznamy).toHaveLength(1)
    expect(k.zaznamy[0].popis).toContain('vzorek pro klienta')
    // cíl je v % tržeb — s Kč ho nejde porovnat, semafor nesmí být zelený
    expect(k.cilPorovnatelny).toBeNull()
    expect(['BEZ_CILE', 'BEZ_DAT']).toContain(k.semafor)
  })

  it('dokončené zakázky = podepsané předávací protokoly v měsíci', async () => {
    const k = await kpiDetail(orgId, 'PARTY', '2026-09')
    expect(k.trend.find(b => b.klic === '2026-09')?.hodnota).toBe(1)
    expect(k.zaznamy[0].href).toMatch(/^\/zakazky\/.+\/predavaky\/.+$/)
  })

  it('party: rozpad podle ★ hlavního technika etapy, jinak zakázky, a bez technika zvlášť', async () => {
    const technik = await prisma.user.findFirstOrThrow({ where: { orgId, role: 'TECHNIK' } })
    const druhy = await prisma.user.create({ data: { orgId, jmeno: 'Druhý technik', email: `${RUN}-t2@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
    const z1 = await prisma.zakazka.findFirstOrThrow({ where: { orgId } })
    const etapa = await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId: z1.id, cislo: 2, nazev: 'Etapa 2', hlavniTechnikId: druhy.id } })
    const z2 = await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-Z2`, nazev: 'Bez technika', klientId: z1.klientId } })
    await prisma.predavak.create({ data: { orgId, zakazkaId: z1.id, etapaId: etapa.id, cislo: `${RUN}-PP2`, technikId: technik.id, stav: 'PODPISAN', podpisano: ZARI } })
    await prisma.predavak.create({ data: { orgId, zakazkaId: z2.id, cislo: `${RUN}-PP3`, technikId: technik.id, stav: 'PODPISAN', podpisano: ZARI } })

    const k = await kpiDetail(orgId, 'PARTY', '2026-09')
    const zari = k.trend.find(b => b.klic === '2026-09')
    expect(zari?.hodnota).toBe(3)
    expect(zari?.detail).toBe('2 party, ø 1,5')
    expect(k.rozpad?.radky.map(r => [r.nazev, r.hodnoty[0]])).toEqual([
      ['Druhý technik', '1'], ['Technik', '1'], ['Bez hlavního technika', '1'],
    ])
    expect(k.zaznamy.map(z => z.hodnota).sort()).toEqual(['Bez hlavního technika', 'Druhý technik', 'Technik'])

    await prisma.predavak.deleteMany({ where: { orgId, cislo: { in: [`${RUN}-PP2`, `${RUN}-PP3`] } } })
    await prisma.zakazkaEtapa.delete({ where: { id: etapa.id } })
    await prisma.zakazka.delete({ where: { id: z2.id } })
  })

  it('na Nástěnce jsou ve výchozím stavu jen KPI s daty', async () => {
    const kpi = await kpiPrehled(orgId, { jenAktivni: true })
    expect(kpi.map(k => k.def.kod).sort()).toEqual(['KONVERZE', 'MATERIAL_BEZ_ZAKAZKY', 'PARTY'])
    const vse = await kpiPrehled(orgId)
    expect(vse).toHaveLength(10)
    expect(vse.find(k => k.def.kod === 'ZALOHY')?.semafor).toBe('BEZ_DAT')
  })

  it('formát hodnot', () => {
    expect(formatKpi(33.333, '%')).toBe('33,3 %')
    expect(formatKpi(null, '%')).toBe('—')
  })
})

describe('nastavení KPI', () => {
  it('správce bez oprávnění kpi nesmí', async () => {
    loginAs(adminId, orgId, 'ADMIN')
    expect((await nastaveniPut(req('PUT', { polozky: [{ kod: 'PARTY', aktivni: false, cil: null, poradi: 1 }] }))).status).toBe(403)
  })
  it('neznámé KPI → 400', async () => {
    loginAs(jednatelId, orgId, 'JEDNATEL')
    expect((await nastaveniPut(req('PUT', { polozky: [{ kod: 'NECO', aktivni: true }] }))).status).toBe(400)
  })
  it('jednatel uloží cíl, pořadí a skrytí; projeví se jen v jeho org', async () => {
    loginAs(jednatelId, orgId, 'JEDNATEL')
    const res = await nastaveniPut(req('PUT', { polozky: [
      { kod: 'PARTY', aktivni: true, cil: 12, poradi: 1 },
      { kod: 'KONVERZE', aktivni: false, cil: 20, poradi: 2 },
    ] }))
    expect(res.status).toBe(200)
    const kpi = await kpiPrehled(orgId, { jenAktivni: true })
    expect(kpi[0].def.kod).toBe('PARTY')
    expect(kpi[0].nastaveni.cil).toBe(12)
    expect(kpi.find(k => k.def.kod === 'KONVERZE')).toBeUndefined()
    expect(await prisma.kpiNastaveni.count({ where: { orgId: ciziOrgId } })).toBe(0)
  })
})

describe('pondělní souhrn', () => {
  it('jen jednatelům org se zapnutým modulem, podruhé do týdne už ne', async () => {
    vi.mocked(sendEmail).mockClear()
    const n = await sweepKpiTydenniSouhrn(prisma)
    const mine = await prisma.notification.findMany({ where: { orgId, typ: TYP_KPI_SOUHRN } })
    expect(mine.map(x => x.userId)).toEqual([jednatelId])
    expect(mine[0].url).toBe('/kpi')
    expect(await prisma.notification.count({ where: { orgId: ciziOrgId, typ: TYP_KPI_SOUHRN } })).toBe(0)
    expect(n).toBeGreaterThanOrEqual(1)
    expect(vi.mocked(sendEmail)).toHaveBeenCalledWith(`${RUN}-j@example.com`, expect.any(String), expect.stringContaining('/kpi'))

    await sweepKpiTydenniSouhrn(prisma)
    expect(await prisma.notification.count({ where: { orgId, typ: TYP_KPI_SOUHRN } })).toBe(1)
  })
})
