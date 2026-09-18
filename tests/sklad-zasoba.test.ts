import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as prijemPost } from '@/app/api/sklad/prijem/route'
import { POST as korekcePost } from '@/app/api/sklad/korekce/route'
import { GET as zasobyGet } from '@/app/api/sklad/zasoby/route'
import { POST as rezervacePost } from '@/app/api/zakazky/[id]/sklad/route'
import { POST as stornoPost } from '@/app/api/zakazky/[id]/sklad/storno/route'
import { POST as polozkyPost } from '@/app/api/zakazky/[id]/polozky/route'
import { POST as predavakyPost } from '@/app/api/predavaky/route'
import { PATCH as predavakPatch } from '@/app/api/predavaky/[id]/route'
import { POST as schvalitPost } from '@/app/api/predavaky/[id]/schvalit/route'
import { getServerSession } from 'next-auth'
import { stavProduktu, stavSkladu } from '@/lib/sklad'
import { polozkyZAktivniNabidky } from '@/lib/zakazkaWorkflow'

/**
 * Sklad v2: zásoba vedená na katalogovém produktu, dopočítaná z deníku pohybů.
 *   naSklade = příjem − výdej + vrátka ± korekce; rezervovano = rezervace − storno − výdej + vrátka
 */

const RUN = `sklad-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let ciziAdminId: string
let productId: string
let ciziProductId: string
let zakazkaId: string
let polozkaId: string
let dealId: string

function loginAs(userId: string, org: string, role = 'ADMIN') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role } } as never)
}

const json = (url: string, body: unknown) => new Request(url, { method: 'POST', body: JSON.stringify(body) })

async function stav() {
  return stavProduktu(orgPrisma(orgId), orgId, productId)
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Sklad', slug: RUN } })
  orgId = org.id
  const cizi = await prisma.organization.create({ data: { nazev: 'Test Sklad cizí', slug: `${RUN}-cizi` } })
  ciziOrgId = cizi.id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Skladník', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })).id
  ciziAdminId = (await prisma.user.create({
    data: { orgId: ciziOrgId, jmeno: 'Cizí', email: `${RUN}-cizi@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })).id

  productId = (await prisma.product.create({
    data: { orgId, kod: 'TC-01', nazev: 'Tepelné čerpadlo', standardniCena: 100000, nakladovaCena: 70000, minMnozstvi: 2 },
  })).id
  ciziProductId = (await prisma.product.create({
    data: { orgId: ciziOrgId, kod: 'TC-01', nazev: 'Cizí produkt', standardniCena: 1, nakladovaCena: 1 },
  })).id

  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const deal = await prisma.deal.create({
    data: { orgId, clientId: klient.id, predmet: 'TČ', kod: `${RUN}-op`, technologie: 'TEPELNE_CERPADLO' },
  })
  dealId = deal.id
  const quote = await prisma.quote.create({ data: { orgId, dealId, nazev: 'Nabídka', dphSazba: 12, aktivni: true } })
  await prisma.quoteItem.create({
    data: { dealId, quoteId: quote.id, productId, nazev: 'Tepelné čerpadlo', mnozstvi: 3, cenaZaKus: 100000, nakupniCena: 70000, poradi: 0 },
  })

  const zakazka = await prisma.zakazka.create({
    data: {
      orgId,
      cislo: `${RUN}-ZAK-001`,
      nazev: 'Zakázka sklad',
      klientId: klient.id,
      vedouciId: adminId,
      stav: 'V_REALIZACI',
      polozky: { create: [{ productId, nazev: 'Tepelné čerpadlo', mnozstvi: 3, jednotka: 'ks', prodejniCena: 100000, dphSazba: 12, poradi: 0 }] },
    },
    include: { polozky: true },
  })
  zakazkaId = zakazka.id
  polozkaId = zakazka.polozky[0].id
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.notification.deleteMany({ where: { orgId: org } })
    await prisma.auditLog.deleteMany({ where: { orgId: org } })
    await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovani: { orgId: org } } })
    await prisma.vyuctovani.deleteMany({ where: { orgId: org } })
    await prisma.predavakPolozka.deleteMany({ where: { predavak: { orgId: org } } })
    await prisma.predavak.deleteMany({ where: { orgId: org } })
    await prisma.skladPohyb.deleteMany({ where: { orgId: org } })
    await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId: org } } })
    await prisma.zakazka.deleteMany({ where: { orgId: org } })
    await prisma.quoteItem.deleteMany({ where: { deal: { orgId: org } } })
    await prisma.quote.deleteMany({ where: { orgId: org } })
    await prisma.deal.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.product.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } })
  }
})

describe('vazba položky zakázky na katalog', () => {
  it('polozkyZAktivniNabidky přenáší productId z nabídky', async () => {
    const polozky = await polozkyZAktivniNabidky(dealId, orgId)
    expect(polozky).toHaveLength(1)
    expect(polozky[0].productId).toBe(productId)
  })

  it('POST položky zakázky uloží productId', async () => {
    loginAs(adminId, orgId)
    const res = await polozkyPost(json('http://test', { productId, nazev: 'Druhé TČ', mnozstvi: 1 }), { params: { id: zakazkaId } })
    expect(res.status).toBe(201)
    const p = await res.json()
    expect(p.productId).toBe(productId)
    await prisma.zakazkaPolozka.delete({ where: { id: p.id } })
  })
})

describe('zůstatky skladu', () => {
  it('příjem vyžaduje produkt z katalogu', async () => {
    loginAs(adminId, orgId)
    const res = await prijemPost(json('http://test', { nazev: 'Volný text', mnozstvi: 5 }))
    expect(res.status).toBe(400)
  })

  it('příjem 10 ks → na skladě 10, dostupné 10 (cena z katalogu)', async () => {
    loginAs(adminId, orgId)
    const res = await prijemPost(json('http://test', { productId, mnozstvi: 10 }))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(Number(body.nakupniCena)).toBe(70000)
    expect(body.stav).toEqual({ naSklade: 10, rezervovano: 0, dostupne: 10 })
  })

  it('rezervace 3 ks → rezervováno 3, dostupné 7, na skladě 10', async () => {
    loginAs(adminId, orgId)
    const res = await rezervacePost(json('http://test', { polozkaId, mnozstvi: 3, nakupniCena: 70000 }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stav).toEqual({ naSklade: 10, rezervovano: 3, dostupne: 7 })
    const pohyb = await prisma.skladPohyb.findFirst({ where: { orgId, polozkaId, typ: 'REZERVACE' } })
    expect(pohyb?.productId).toBe(productId)
  })

  it('storno rezervace → zpět na 10 dostupných, typ STORNO_REZERVACE', async () => {
    loginAs(adminId, orgId)
    const res = await stornoPost(json('http://test', { polozkaId, duvod: 'test' }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    expect(await stav()).toEqual({ naSklade: 10, rezervovano: 0, dostupne: 10 })
    expect(await prisma.skladPohyb.count({ where: { orgId, typ: 'STORNO' } })).toBe(0)
    expect(await prisma.skladPohyb.count({ where: { orgId, typ: 'STORNO_REZERVACE', productId } })).toBe(1)
  })

  it('rezervace nad dostupné množství projde a dostupné jde do minusu', async () => {
    loginAs(adminId, orgId)
    const res = await rezervacePost(json('http://test', { polozkaId, mnozstvi: 12, nakupniCena: 70000 }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.stav).toEqual({ naSklade: 10, rezervovano: 12, dostupne: -2 })
    // dostupné (-2) ≤ minimum (2) → upozornění správcům skladu, jen jednou
    const n = await prisma.notification.findMany({ where: { orgId, typ: 'SKLAD_MINIMUM' } })
    expect(n).toHaveLength(1)
    expect(n[0].url).toBe(`/products/${productId}`)
    await stornoPost(json('http://test', { polozkaId, duvod: 'test' }), { params: { id: zakazkaId } })
    await rezervacePost(json('http://test', { polozkaId, mnozstvi: 3, nakupniCena: 70000 }), { params: { id: zakazkaId } })
    expect(await prisma.notification.count({ where: { orgId, typ: 'SKLAD_MINIMUM' } })).toBe(1)
    expect(await stav()).toEqual({ naSklade: 10, rezervovano: 3, dostupne: 7 })
  })

  it('schválení předáváku (výdej) → na skladě 7, rezervováno 0; vrácení protokolu vše vrátí', async () => {
    loginAs(adminId, orgId)
    const created = await predavakyPost(json('http://test/api/predavaky', { zakazkaId }))
    expect(created.status).toBe(201)
    const predavak = await created.json()
    await prisma.predavak.update({ where: { id: predavak.id }, data: { stav: 'PODPISAN', podpisano: new Date() } })

    const schvaleno = await schvalitPost(new Request('http://test'), { params: { id: predavak.id } })
    expect(schvaleno.status).toBe(200)
    expect(await stav()).toEqual({ naSklade: 7, rezervovano: 0, dostupne: 7 })
    const vydej = await prisma.skladPohyb.findFirst({ where: { orgId, polozkaId, typ: 'VYDEJ' } })
    expect(vydej?.productId).toBe(productId)

    const reopened = await predavakPatch(
      new Request('http://test', { method: 'PATCH', body: JSON.stringify({ reopen: true }) }),
      { params: { id: predavak.id } },
    )
    expect(reopened.status).toBe(200)
    expect(await stav()).toEqual({ naSklade: 10, rezervovano: 3, dostupne: 7 })
    expect(await prisma.skladPohyb.count({ where: { orgId, polozkaId, typ: 'VRATKA_VYDEJE' } })).toBe(1)
    expect((await prisma.zakazkaPolozka.findUnique({ where: { id: polozkaId } }))?.stav).toBe('NASKLADNENO')
  })

  it('korekce ± mění na skladě, vyžaduje důvod', async () => {
    loginAs(adminId, orgId)
    const bezDuvodu = await korekcePost(json('http://test', { productId, mnozstvi: -1 }))
    expect(bezDuvodu.status).toBe(400)
    const minus = await korekcePost(json('http://test', { productId, mnozstvi: -1, duvod: 'inventura' }))
    expect(minus.status).toBe(201)
    expect((await minus.json()).stav).toEqual({ naSklade: 9, rezervovano: 3, dostupne: 6 })
    const plus = await korekcePost(json('http://test', { productId, mnozstvi: 2.5, duvod: 'nález' }))
    expect((await plus.json()).stav).toEqual({ naSklade: 11.5, rezervovano: 3, dostupne: 8.5 })
  })

  it('GET /api/sklad/zasoby vrací produkt s pohybem i dotaz na jeden produkt', async () => {
    loginAs(adminId, orgId)
    const one = await zasobyGet(new Request(`http://test/api/sklad/zasoby?productId=${productId}`))
    expect(await one.json()).toEqual({ naSklade: 11.5, rezervovano: 3, dostupne: 8.5 })
    const all = await (await zasobyGet(new Request('http://test/api/sklad/zasoby'))).json()
    expect(all).toHaveLength(1)
    expect(all[0]).toMatchObject({ id: productId, kod: 'TC-01', minMnozstvi: 2, hodnota: 11.5 * 70000 })
  })

  it('tenant izolace: cizí org zůstatky nevidí a nemůže na cizí produkt naskladnit', async () => {
    expect((await stavSkladu(orgPrisma(ciziOrgId), ciziOrgId)).size).toBe(0)
    loginAs(ciziAdminId, ciziOrgId)
    const res = await prijemPost(json('http://test', { productId, mnozstvi: 1 }))
    expect(res.status).toBe(404)
    const own = await prijemPost(json('http://test', { productId: ciziProductId, mnozstvi: 1 }))
    expect(own.status).toBe(201)
    expect((await stavSkladu(orgPrisma(orgId), orgId)).has(ciziProductId)).toBe(false)
  })
})
