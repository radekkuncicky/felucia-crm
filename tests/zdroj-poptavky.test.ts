import { describe, it, expect, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as leadyPost } from '@/app/api/leady/route'
import { PATCH as leadPatch } from '@/app/api/leady/[id]/route'
import { POST as leadConvert } from '@/app/api/leady/[id]/convert/route'
import { POST as dealsPost } from '@/app/api/deals/route'
import { PATCH as dealPatch } from '@/app/api/deals/[id]/route'
import { POST as hovorPost } from '@/app/api/hovor/route'
import { POST as websiteLeadsPost } from '@/app/api/public/website-leads/route'
import { nactiZdroje, jeZGoogleAds, VYCHOZI_ZDROJE } from '@/lib/zdrojPoptavky'
import { kpiDetail } from '@/lib/kpi'
import { mesicKlic } from '@/lib/kpi/obdobi'

/** KPI fáze 2 — zdroj poptávky (docs/kpi-vedeni, KPI 6) */

const RUN = `zdroj-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let klientId: string
let zdroje: Record<string, string>
let ciziZdrojId: string

function jakoAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN', plan: 'STANDARD' } } as never)
}
const req = (method: string, body: unknown) => new Request('http://test', {
  method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Zdroj', slug: RUN, plan: 'STANDARD' } })).id
  await prisma.orgSettings.create({ data: { orgId, modulKpi: true } })
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Test Zdroj cizí', slug: `${RUN}-cizi`, plan: 'STANDARD' } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Adam Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  klientId = (await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Doporučitel' } })).id
  zdroje = Object.fromEntries((await nactiZdroje(orgPrisma(orgId), orgId)).map(z => [z.kod, z.id]))
  ciziZdrojId = (await nactiZdroje(orgPrisma(ciziOrgId), ciziOrgId))[0].id
  jakoAdmin()
})

describe('číselník zdrojů', () => {
  it('výchozí zdroje se založí jednou a per org', async () => {
    expect(Object.keys(zdroje)).toEqual(VYCHOZI_ZDROJE.map(z => z.kod))
    await nactiZdroje(orgPrisma(orgId), orgId)
    expect(await prisma.zdrojPoptavky.count({ where: { orgId } })).toBe(VYCHOZI_ZDROJE.length)
    expect(await prisma.zdrojPoptavky.count({ where: { orgId: ciziOrgId } })).toBe(VYCHOZI_ZDROJE.length)
  })

  it('Google Ads podle gclid / UTM, jinak nic', () => {
    expect(jeZGoogleAds('https://nanto.cz/kontakt?gclid=abc')).toBe(true)
    expect(jeZGoogleAds(null, { utm_source: 'google', utm_medium: 'cpc' })).toBe(true)
    expect(jeZGoogleAds({ gbraid: 'x' })).toBe(true)
    expect(jeZGoogleAds('https://nanto.cz/kontakt?utm_source=google&utm_medium=organic')).toBe(false)
    expect(jeZGoogleAds('https://nanto.cz/kontakt', { pageUrl: 'https://nanto.cz' })).toBe(false)
    expect(jeZGoogleAds('neplatná url %%%')).toBe(false)
  })
})

describe('lead a OP', () => {
  it('s modulem KPI je zdroj u ručního leadu povinný; cizí zdroj neprojde', async () => {
    expect((await leadyPost(req('POST', { jmeno: 'Bez zdroje' }))).status).toBe(400)
    expect((await leadyPost(req('POST', { jmeno: 'Cizí', zdrojPoptavkyId: ciziZdrojId }))).status).toBe(400)
    const res = await leadyPost(req('POST', { jmeno: 'Doporučený', zdrojPoptavkyId: zdroje.DOPORUCENI, doporucilKlientId: klientId }))
    expect(res.status).toBe(201)
    const lead = await res.json()
    expect(lead.zdrojPoptavkyId).toBe(zdroje.DOPORUCENI)
    expect(lead.doporucilKlientId).toBe(klientId)
  })

  it('jiný zdroj než doporučení smaže „kdo doporučil“', async () => {
    const lead = await prisma.lead.create({ data: { orgId, jmeno: 'X', zdrojPoptavkyId: zdroje.DOPORUCENI, doporucilText: 'soused' } })
    const res = await leadPatch(req('PATCH', { zdrojPoptavkyId: zdroje.PARTNER }), { params: { id: lead.id } })
    expect(res.status).toBe(200)
    const po = await prisma.lead.findUniqueOrThrow({ where: { id: lead.id } })
    expect(po.zdrojPoptavkyId).toBe(zdroje.PARTNER)
    expect(po.doporucilText).toBeNull()
  })

  it('převod leadu zkopíruje zdroj na OP; doplnění zdroje u převedeného leadu ho dopíše na OP bez zdroje', async () => {
    const lead = await prisma.lead.create({ data: { orgId, jmeno: 'Jan Převod', zdrojPoptavkyId: zdroje.DOPORUCENI, doporucilText: 'švagr' } })
    const res = await leadConvert(req('POST', { technologie: 'KLIMA' }), { params: { id: lead.id } })
    expect(res.status).toBe(201)
    const { dealId } = await res.json()
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })
    expect(deal.zdrojPoptavkyId).toBe(zdroje.DOPORUCENI)
    expect(deal.doporucilText).toBe('švagr')

    const lead2 = await prisma.lead.create({ data: { orgId, jmeno: 'Eva Bez' } })
    const { dealId: deal2Id } = await (await leadConvert(req('POST', { technologie: 'KLIMA' }), { params: { id: lead2.id } })).json()
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal2Id } })).zdrojPoptavkyId).toBeNull()
    await leadPatch(req('PATCH', { zdrojPoptavkyId: zdroje.GOOGLE_ADS }), { params: { id: lead2.id } })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal2Id } })).zdrojPoptavkyId).toBe(zdroje.GOOGLE_ADS)
  })

  it('zápis hovoru: převod leadu na OP převezme zdroj leadu', async () => {
    const lead = await prisma.lead.create({ data: { orgId, jmeno: 'Volající', zdrojPoptavkyId: zdroje.PARTNER } })
    const res = await hovorPost(req('POST', { cil: 'NOVY_OP', leadId: lead.id, jmeno: 'Volající', technologie: 'KLIMA' }))
    expect(res.status).toBe(201)
    const { dealId } = await res.json()
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })).zdrojPoptavkyId).toBe(zdroje.PARTNER)
  })

  it('výhra OP nastaví datum výhry, návrat ze stavu Úspěch ho smaže', async () => {
    const res = await dealsPost(req('POST', { clientId: klientId, technologie: 'KLIMA', zdrojPoptavkyId: zdroje.OPAKOVANY }))
    expect(res.status).toBe(201)
    const deal = await res.json()
    expect(deal.zdrojPoptavkyId).toBe(zdroje.OPAKOVANY)

    await dealPatch(req('PATCH', { stav: 'USPECH' }), { params: { id: deal.id } })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).vyhrano).toBeInstanceOf(Date)
    await dealPatch(req('PATCH', { stav: 'JEDNANI' }), { params: { id: deal.id } })
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).vyhrano).toBeNull()
  })
})

describe('webový formulář', () => {
  it('gclid v adrese stránky → zdroj Google Ads, bez něj prázdný', async () => {
    const apiKey = `nk_${RUN}`
    await prisma.apiKey.create({ data: { orgId, nazev: 'Web', klic: apiKey } })
    const posli = async (pageUrl: string, i: number) => {
      const res = await websiteLeadsPost(new NextRequest('http://localhost/api/public/website-leads', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'x-forwarded-for': `10.0.9.${i}` },
        body: JSON.stringify({
          source: 'contact_form', submittedAt: new Date(Date.now() - i * 1000).toISOString(),
          contact: { name: 'Web Lead', email: `web${i}-${RUN}@example.cz` }, meta: { pageUrl },
        }),
      }))
      return prisma.lead.findUniqueOrThrow({ where: { id: (await res.json()).id } })
    }
    expect((await posli('https://nanto.cz/kontakt?gclid=Cj0K', 1)).zdrojPoptavkyId).toBe(zdroje.GOOGLE_ADS)
    expect((await posli('https://nanto.cz/kontakt', 2)).zdrojPoptavkyId).toBeNull()
  })
})

describe('KPI 6 — rozpad podle zdroje', () => {
  it('leady podle zdroje leadu, vyhrané OP podle data výhry a zdroje OP, jen vlastní org', async () => {
    const mesic = '2026-09'
    const zari = new Date('2026-09-10T10:00:00Z')
    const vyhra = await prisma.deal.create({
      data: { orgId, clientId: klientId, kod: `${RUN}-v1`, technologie: 'KLIMA', stav: 'USPECH', vyhrano: zari, zdrojPoptavkyId: zdroje.GOOGLE_ADS },
    })
    await prisma.quote.create({
      data: {
        orgId, dealId: vyhra.id, nazev: 'N1', aktivni: true,
        items: { create: [{ dealId: vyhra.id, nazev: 'Klima', mnozstvi: 2, cenaZaKus: 50000, sleva: 10 }] },
      },
    })
    await prisma.lead.create({ data: { orgId, jmeno: 'L1', vytvoreno: zari, zdrojPoptavkyId: zdroje.GOOGLE_ADS, prevedenNaOpId: vyhra.id, status: 'PREVEDEN' } })
    await prisma.lead.create({ data: { orgId, jmeno: 'L2', vytvoreno: zari, zdrojPoptavkyId: zdroje.GOOGLE_ADS } })
    await prisma.lead.create({ data: { orgId, jmeno: 'L3', vytvoreno: zari } })
    // vyhraný OP bez zdroje z jiného měsíce se do září nepočítá
    await prisma.deal.create({ data: { orgId, clientId: klientId, kod: `${RUN}-v2`, technologie: 'KLIMA', stav: 'USPECH', vyhrano: new Date('2026-08-10T10:00:00Z') } })
    // cizí org
    const ciziKlient = await prisma.client.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', prijmeni: 'Klient' } })
    await prisma.deal.create({ data: { orgId: ciziOrgId, clientId: ciziKlient.id, kod: `${RUN}-c1`, technologie: 'KLIMA', stav: 'USPECH', vyhrano: zari, zdrojPoptavkyId: ciziZdrojId } })

    const k = await kpiDetail(orgId, 'KONVERZE', mesic, new Date('2026-10-18T10:00:00Z'))
    expect(k.rozpad?.sloupce).toHaveLength(5)
    const ads = k.rozpad!.radky.find(r => r.klic === zdroje.GOOGLE_ADS)!
    expect(ads.hodnoty.slice(0, 4)).toEqual(['2', '1', '50 %', '1'])
    expect(ads.hodnoty[4].replace(/\s/g, ' ')).toMatch(/^90 000/)
    const bez = k.rozpad!.radky.find(r => r.klic === '')!
    expect(bez.hodnoty.slice(0, 4)).toEqual(['1', '0', '0 %', '0'])
    // prázdné zdroje se nezobrazují
    expect(k.rozpad!.radky.some(r => r.klic === zdroje.PARTNER)).toBe(false)
    expect(mesicKlic(zari)).toBe(mesic)
  })
})
