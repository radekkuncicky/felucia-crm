import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as itemsPost } from '@/app/api/deals/[id]/quotes/[quoteId]/items/route'
import { POST as quotesPost } from '@/app/api/deals/[id]/quotes/route'
import { POST as dealItemsPost } from '@/app/api/deals/[id]/items/route'
import { getServerSession } from 'next-auth'

const RUN = `qi-nakupky-${Date.now()}`

let orgId: string
let userId: string
let dealId: string
let quoteId: string
let prodSNakupkou: string
let prodBezNakupky: string

function req(url: string, body: Record<string, unknown>) {
  return new Request(`http://localhost${url}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function asRole(role: 'ADMIN' | 'OBCHODNIK') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role } } as never)
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test nákupky', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Adam Admin', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' },
  })
  userId = user.id
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const deal = await prisma.deal.create({
    data: { orgId, clientId: client.id, predmet: 'Klimatizace', kod: `${RUN}-op`, technologie: 'KLIMA' },
  })
  dealId = deal.id
  const quote = await prisma.quote.create({ data: { orgId, dealId, nazev: 'Nabídka 1', dphSazba: 21, aktivni: true } })
  quoteId = quote.id
  const p1 = await prisma.product.create({
    data: { orgId, kod: `${RUN}-A`, nazev: 'Jednotka s nákupkou', jednotka: 'ks', standardniCena: 25000, nakladovaCena: 18000 },
  })
  prodSNakupkou = p1.id
  const p2 = await prisma.product.create({
    data: { orgId, kod: `${RUN}-B`, nazev: 'Montáž bez nákupky', jednotka: 'hod', standardniCena: 1200 },
  })
  prodBezNakupky = p2.id
  asRole('ADMIN')
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.quoteItem.deleteMany({ where: { dealId } })
  await prisma.quote.deleteMany({ where: { orgId } })
  await prisma.product.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('snapshot nákupní ceny z knihovny při vzniku položky nabídky', () => {
  it('bulk POST /items — produkt s nákladovou cenou → nakupniCena, bez ní → null, volný řádek → null', async () => {
    const res = await itemsPost(
      req(`/api/deals/${dealId}/quotes/${quoteId}/items`, {
        items: [
          { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 2, cenaZaKus: 25000 },
          { productId: prodBezNakupky, nazev: 'Montáž', mnozstvi: 4, cenaZaKus: 1200 },
          { nazev: 'Volný řádek', mnozstvi: 1, cenaZaKus: 500 },
        ],
      }),
      { params: { id: dealId, quoteId } },
    )
    expect(res.status).toBe(201)
    const created = await res.json()
    expect(created).toHaveLength(3)
    expect(Number(created[0].nakupniCena)).toBe(18000)
    expect(created[0].jednotka).toBe('ks')
    expect(created[1].nakupniCena).toBeNull()
    expect(created[1].jednotka).toBe('hod')
    expect(created[2].nakupniCena).toBeNull()
  })

  it('single POST /items — snapshot z produktu; explicitní nakupniCena má přednost (ADMIN má financeNakupkyEdit)', async () => {
    const r1 = await itemsPost(
      req(`/api/deals/${dealId}/quotes/${quoteId}/items`, { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000 }),
      { params: { id: dealId, quoteId } },
    )
    expect(r1.status).toBe(201)
    expect(Number((await r1.json()).nakupniCena)).toBe(18000)

    const r2 = await itemsPost(
      req(`/api/deals/${dealId}/quotes/${quoteId}/items`, { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000, nakupniCena: 17000 }),
      { params: { id: dealId, quoteId } },
    )
    expect(Number((await r2.json()).nakupniCena)).toBe(17000)
  })

  it('bez financeNakupkyEdit (OBCHODNIK) se explicitní hodnota ignoruje a použije se snapshot z produktu', async () => {
    asRole('OBCHODNIK')
    const res = await itemsPost(
      req(`/api/deals/${dealId}/quotes/${quoteId}/items`, { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000, nakupniCena: 1 }),
      { params: { id: dealId, quoteId } },
    )
    expect(Number((await res.json()).nakupniCena)).toBe(18000)
    asRole('ADMIN')
  })

  it('POST /quotes s položkami (šablona) doplní nákupní cenu i jednotku z produktu', async () => {
    const res = await quotesPost(
      req(`/api/deals/${dealId}/quotes`, {
        nazev: 'Ze šablony',
        items: [
          { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000 },
          { productId: prodBezNakupky, nazev: 'Montáž', mnozstvi: 3, cenaZaKus: 1200 },
        ],
      }),
      { params: { id: dealId } },
    )
    expect(res.status).toBe(201)
    const q = await res.json()
    const items = await prisma.quoteItem.findMany({ where: { quoteId: q.id }, orderBy: { poradi: 'asc' } })
    expect(items).toHaveLength(2)
    expect(Number(items[0].nakupniCena)).toBe(18000)
    expect(items[1].nakupniCena).toBeNull()
    expect(items[1].jednotka).toBe('hod')
  })

  it('legacy POST /deals/[id]/items doplní kód, jednotku i nákupní cenu z produktu', async () => {
    const res = await dealItemsPost(
      req(`/api/deals/${dealId}/items`, { productId: prodSNakupkou, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000 }),
      { params: { id: dealId } },
    )
    expect(res.status).toBe(201)
    const item = await res.json()
    expect(Number(item.nakupniCena)).toBe(18000)
    expect(item.kod).toBe(`${RUN}-A`)
    expect(item.jednotka).toBe('ks')
  })
})
