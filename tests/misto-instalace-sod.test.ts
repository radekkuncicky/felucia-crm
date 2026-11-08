import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as sodPost } from '@/app/api/sod/route'
import { PATCH as sodPatch } from '@/app/api/sod/[id]/route'
import { createZakazkaFromDeal } from '@/lib/zakazkaWorkflow'
import { getServerSession } from 'next-auth'

const RUN = `misto-inst-${Date.now()}`

let orgId: string
let userId: string
let clientId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test místo instalace', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Oto Obchodník', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' },
  })
  userId = user.id
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient', ulice: 'Domovská 1', mesto: 'Brno' } })
  clientId = client.id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role: 'ADMIN' } } as never)
})

afterAll(async () => {
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

async function novyDeal(kod: string, adresaDila: string | null = null) {
  return prisma.deal.create({ data: { orgId, clientId, predmet: 'TČ', kod: `${RUN}-${kod}`, technologie: 'TEPELNE_CERPADLO', adresaDila } })
}

function req(url: string, method: string, body: Record<string, unknown>) {
  return new Request(url, { method, headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

describe('Místo instalace ze SOD → zakázka', () => {
  it('nová SOD propíše adresu díla do OP a zakázka ji převezme', async () => {
    const deal = await novyDeal('a')
    const res = await sodPost(req('http://localhost/api/sod', 'POST', { dealId: deal.id, typ: 'DPH_21_BEZ_ZALOHY', klientAdresa: 'Domovská 1, Brno', mistoShodne: false, adresaDila: 'Lesní 12, Hustopeče' }))
    expect(res.status).toBe(201)

    const op = await prisma.deal.findUnique({ where: { id: deal.id } })
    expect(op?.adresaDila).toBe('Lesní 12, Hustopeče')

    const z = await createZakazkaFromDeal(deal.id, orgId, null)
    expect(z?.mistoStavby).toBe('Lesní 12, Hustopeče')
  })

  it('úprava adresy v SOD doplní existující zakázku bez místa stavby, vyplněnou nepřepíše', async () => {
    const deal = await novyDeal('b')
    const res = await sodPost(req('http://localhost/api/sod', 'POST', { dealId: deal.id, typ: 'DPH_21_BEZ_ZALOHY', klientAdresa: 'Domovská 1, Brno', mistoShodne: true }))
    const sod = await res.json()
    const z = await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-b`, opId: deal.id, klientId: clientId, nazev: 'x' } })

    await sodPatch(req(`http://localhost/api/sod/${sod.id}`, 'PATCH', { adresaDila: 'Polní 3, Mikulov' }), { params: { id: sod.id } })
    expect((await prisma.zakazka.findUnique({ where: { id: z.id } }))?.mistoStavby).toBe('Polní 3, Mikulov')

    await sodPatch(req(`http://localhost/api/sod/${sod.id}`, 'PATCH', { adresaDila: 'Jiná 9' }), { params: { id: sod.id } })
    expect((await prisma.zakazka.findUnique({ where: { id: z.id } }))?.mistoStavby).toBe('Polní 3, Mikulov')
    expect((await prisma.deal.findUnique({ where: { id: deal.id } }))?.adresaDila).toBe('Jiná 9')
  })

  it('podepsaná SOD má přednost, stornovaná se ignoruje, bez SOD se vezme adresa z OP', async () => {
    const deal = await novyDeal('c')
    await prisma.sod.create({ data: { orgId, dealId: deal.id, cislo: `${RUN}-c1`, typ: 'DPH_21_BEZ_ZALOHY', klientJmeno: 'K', predmetDila: 'p', adresaDila: 'Podepsaná 1', stav: 'PODEPSANO' } })
    await prisma.sod.create({ data: { orgId, dealId: deal.id, cislo: `${RUN}-c2`, typ: 'DPH_21_BEZ_ZALOHY', klientJmeno: 'K', predmetDila: 'p', adresaDila: 'Storno 2', stav: 'STORNO' } })
    expect((await createZakazkaFromDeal(deal.id, orgId, null))?.mistoStavby).toBe('Podepsaná 1')

    const deal2 = await novyDeal('d', 'Z OP 5')
    expect((await createZakazkaFromDeal(deal2.id, orgId, null))?.mistoStavby).toBe('Z OP 5')
  })
})
