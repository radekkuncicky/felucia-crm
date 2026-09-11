import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as zakazkyPost } from '@/app/api/zakazky/route'
import { getServerSession } from 'next-auth'

const RUN = `zak-nakupky-${Date.now()}`

let orgId: string
let adminId: string
let dealId: string
let klientId: string

function loginAsAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Zakázky Nákupky', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Vedoucí Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  klientId = klient.id
  const deal = await prisma.deal.create({
    data: { orgId, clientId: klient.id, predmet: 'Klimatizace', kod: `${RUN}-op`, technologie: 'KLIMA' },
  })
  dealId = deal.id
  const quote = await prisma.quote.create({ data: { orgId, dealId, nazev: 'Nabídka 1', dphSazba: 21, aktivni: true } })
  await prisma.quoteItem.create({
    data: { dealId, quoteId: quote.id, nazev: 'Jednotka', mnozstvi: 1, cenaZaKus: 25000, nakupniCena: 18000, poradi: 0 },
  })
  await prisma.quoteItem.create({
    data: { dealId, quoteId: quote.id, nazev: 'Montáž', mnozstvi: 4, cenaZaKus: 1200, poradi: 1 },
  })
  loginAsAdmin()
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.quoteItem.deleteMany({ where: { dealId } })
  await prisma.quote.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('zakázka založená z OP přebírá nákupní ceny z aktivní nabídky', () => {
  it('POST /api/zakazky s opId zkopíruje nakupniCena z QuoteItem do ZakazkaPolozka', async () => {
    const res = await zakazkyPost(
      new Request('http://test', {
        method: 'POST',
        body: JSON.stringify({ opId: dealId, klientId, nazev: 'Zakázka z OP' }),
      }),
    )
    expect(res.status).toBe(201)
    const zakazka = await res.json()

    const polozky = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId: zakazka.id }, orderBy: { poradi: 'asc' } })
    expect(polozky).toHaveLength(2)
    expect(Number(polozky[0].nakupniCena)).toBe(18000)
    expect(polozky[1].nakupniCena).toBeNull()
  })
})
