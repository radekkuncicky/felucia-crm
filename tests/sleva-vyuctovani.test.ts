import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as vyuctovaniPost } from '@/app/api/zakazky/[id]/vyuctovani/route'
import { polozkyZAktivniNabidky } from '@/lib/zakazkaWorkflow'
import { radekBezDph } from '@/lib/quoteMath'
import { generateVyuctovaniHtml } from '@/lib/vyuctovaniPdf'
import { getServerSession } from 'next-auth'

const RUN = `sleva-vyu-${Date.now()}`

let orgId: string
let adminId: string
let klientId: string
let dealId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test sleva', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  klientId = klient.id
  const deal = await prisma.deal.create({
    data: { orgId, clientId: klientId, predmet: 'TČ', kod: `${RUN}-op`, technologie: 'TEPELNE_CERPADLO' },
  })
  dealId = deal.id
  const quote = await prisma.quote.create({ data: { orgId, dealId, nazev: 'Nabídka', dphSazba: 12, aktivni: true } })
  await prisma.quoteItem.createMany({
    data: [
      { dealId, quoteId: quote.id, nazev: 'Tepelné čerpadlo', mnozstvi: 1, cenaZaKus: 100000, sleva: 10, poradi: 0 },
      { dealId, quoteId: quote.id, nazev: 'Montáž', mnozstvi: 2, cenaZaKus: 5000, poradi: 1 },
    ],
  })
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
})

afterAll(async () => {
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
})

describe('sleva z nabídky → zakázka → vyúčtování', () => {
  it('položky zakázky přebírají slevu z nabídky a vyúčtování ji drží', async () => {
    const polozky = await polozkyZAktivniNabidky(dealId, orgId)
    expect(polozky.map(p => Number(p.sleva))).toEqual([10, 0])

    const zakazka = await prisma.zakazka.create({
      data: {
        orgId, cislo: `${RUN}-ZAK`, nazev: 'Zakázka', klientId, vedouciId: adminId, opId: dealId,
        stav: 'V_REALIZACI', polozky: { create: polozky },
      },
    })

    const res = await vyuctovaniPost(new Request('http://test', { method: 'POST', body: '{}' }), { params: { id: zakazka.id } })
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const vp = await prisma.vyuctovaniPolozka.findMany({ where: { vyuctovaniId: id }, orderBy: { poradi: 'asc' } })
    expect(vp.map(p => Number(p.sleva))).toEqual([10, 0])

    const bezDph = vp.reduce((s, p) => s + radekBezDph(p), 0)
    expect(bezDph).toBe(90000 + 10000)
  })

  it('PDF počítá součet po slevě a ukáže sloupec Sleva', () => {
    const html = generateVyuctovaniHtml({
      cislo: 'V-1', stav: 'NAVRH', poznamka: null, vytvoreno: new Date(), schvaleno: null,
      zakazka: {
        cislo: 'Z-1', nazev: 'Z',
        klient: { jmeno: 'K', prijmeni: 'K', ulice: null, mesto: null, psc: null, email: null, telefon: null },
        organization: { nazev: 'Org', logo: null, ulice: null, mesto: null, psc: null, ico: null, dic: null, telefon: null },
      },
      polozky: [{ nazev: 'TČ', mnozstvi: 1, jednotka: 'ks', nakupniCena: null, prodejniCena: 100000, sleva: 10, dphSazba: 12 }],
    } as never)
    expect(html).toContain('>Sleva<')
    expect(html.replace(/\s|&nbsp;| /g, '')).toContain('90000')
  })
})
