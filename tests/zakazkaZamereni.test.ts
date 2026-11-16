import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { GET as podkladyGet } from '@/app/api/mobile/zakazka/[id]/podklady/route'
import { nactiZamereniPrehled } from '@/lib/zamereniPrehled'
import { orgPrisma } from '@/lib/orgPrisma'

/** Zakázka vidí zaměření a fotky z OP (appka Sales) — web Podklady i mobilní API techniků */

const RUN = `zak-zam-${Date.now()}`
let orgId: string
let ciziOrgId: string
let adminId: string
let dealId: string
let zakazkaId: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Zak zam', slug: RUN, plan: 'PROFESSIONAL' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-c` } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Zaměřený' } })
  dealId = (await prisma.deal.create({ data: { orgId, clientId: klient.id, userId: adminId, technologie: 'KLIMA' } })).id
  const definice = await prisma.zamereniDefinice.create({
    data: {
      orgId, typ: 'KLIMA', nazev: 'Klima', povinneTagy: [],
      schemaJson: { sekce: [{ nazev: 'Jednotky', otazky: [{ klic: 'vj', popisek: 'Vnitřní jednotky', typ: 'TEXT' }, { klic: 'prazdna', popisek: 'Nic', typ: 'TEXT' }] }] },
    },
  })
  const z = await prisma.zamereni.create({
    data: { orgId, dealId, typ: 'KLIMA', definiceId: definice.id, definiceVerze: 1, odpovedi: { vj: 'obývák + ložnice 2. patro' } },
  })
  await prisma.zamereniFoto.create({ data: { orgId, zamereniId: z.id, url: '/uploads/zamereni/x.jpg', tag: 'JINE', popis: 'venkovní' } })
  await prisma.photo.create({ data: { orgId, dealId, nazev: 'dum.jpg', cesta: '/uploads/deals/dum.jpg' } })
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-Z`, klientId: klient.id, nazev: 'Klima', opId: dealId } })).id
})

afterAll(async () => {
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.photo.deleteMany({ where: { orgId } })
  await prisma.zamereniDefinice.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, ciziOrgId] } } })
})

describe('zaměření z OP v zakázce', () => {
  it('nactiZamereniPrehled: jen vyplněné odpovědi po sekcích + fotky; cizí org nic', async () => {
    const z = await nactiZamereniPrehled(orgPrisma(orgId), orgId, dealId, 'Opava')
    expect(z).toHaveLength(1)
    expect(z[0]).toMatchObject({ typ: 'KLIMA', adresa: 'Opava', sekce: [{ nazev: 'Jednotky', otazky: [{ popisek: 'Vnitřní jednotky', hodnota: 'obývák + ložnice 2. patro' }] }] })
    expect(z[0].fotky).toEqual([expect.objectContaining({ url: '/uploads/zamereni/x.jpg', popis: 'venkovní' })])
    expect(await nactiZamereniPrehled(orgPrisma(ciziOrgId), ciziOrgId, dealId, null)).toEqual([])
  })

  it('mobilní podklady technika obsahují opFotky a zaměření s absolutními URL', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN', plan: 'PROFESSIONAL' } } as never)
    const res = await podkladyGet(new Request('http://test/api', { headers: { host: 'firma.felucia.io' } }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.opFotky).toEqual([expect.objectContaining({ nazev: 'dum.jpg', url: expect.stringMatching(/^https:\/\/firma.felucia.io\/uploads\/deals\/dum.jpg/) })])
    expect(data.zamereni[0].sekce[0].otazky[0].hodnota).toBe('obývák + ložnice 2. patro')
    expect(data.zamereni[0].fotky[0].url).toMatch(/^https:\/\/firma.felucia.io\/uploads\/zamereni\/x.jpg/)
  })
})
