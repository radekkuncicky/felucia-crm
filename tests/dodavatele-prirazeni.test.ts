import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as objednatPost } from '@/app/api/zakazky/[id]/objednavky/route'
import { POST as bulkPost } from '@/app/api/products/dodavatele/bulk/route'
import { getServerSession } from 'next-auth'

const RUN = `dod-prir-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let dodavatelX: string
let dodavatelY: string
let productA: string
let productB: string
let ciziProduct: string
let zakazkaId: string
let polozkaA: string

function loginAs(userId: string, role = 'ADMIN') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role } } as never)
}
const json = (body: unknown) => new Request('http://test', { method: 'POST', body: JSON.stringify(body) })
const vazby = (productId: string) =>
  prisma.productDodavatel.findMany({ where: { productId }, select: { dodavatelId: true, hlavni: true }, orderBy: { vytvoreno: 'asc' } })

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test přiřazení dodavatele', slug: RUN } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  dodavatelX = (await prisma.dodavatel.create({ data: { orgId, nazev: 'X' } })).id
  dodavatelY = (await prisma.dodavatel.create({ data: { orgId, nazev: 'Y' } })).id
  productA = (await prisma.product.create({ data: { orgId, kod: 'A', nazev: 'A', standardniCena: 100 } })).id
  productB = (await prisma.product.create({ data: { orgId, kod: 'B', nazev: 'B', standardniCena: 100 } })).id
  ciziProduct = (await prisma.product.create({ data: { orgId: ciziOrgId, kod: 'C', nazev: 'C', standardniCena: 100 } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'K', prijmeni: 'L' } })
  const z = await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-Z`, nazev: 'Z', klientId: klient.id, vedouciId: adminId, stav: 'V_REALIZACI',
      polozky: { create: [{ productId: productA, nazev: 'A', mnozstvi: 1, jednotka: 'ks', poradi: 0 }] },
    },
    include: { polozky: true },
  })
  zakazkaId = z.id
  polozkaA = z.polozky[0].id
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.auditLog.deleteMany({ where: { orgId: org } })
    await prisma.objednavkaPolozka.deleteMany({ where: { orgId: org } })
    await prisma.objednavka.deleteMany({ where: { orgId: org } })
    await prisma.productDodavatel.deleteMany({ where: { orgId: org } })
    await prisma.dodavatel.deleteMany({ where: { orgId: org } })
    await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId: org } } })
    await prisma.zakazka.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.product.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } }).catch(() => {})
  }
})

describe('dodavatel u produktu', () => {
  it('objednávka se „zapamatovat“ uloží dodavatele k produktu jako hlavního', async () => {
    loginAs(adminId)
    const res = await objednatPost(json({
      skupiny: [{ dodavatelId: dodavatelX, polozky: [{ zakazkaPolozkaId: polozkaA, mnozstvi: 1, zapamatovat: true }] }],
    }), { params: { id: zakazkaId } })
    expect(res.status).toBe(201)
    expect(await vazby(productA)).toEqual([{ dodavatelId: dodavatelX, hlavni: true }])
  })

  it('hromadné přiřazení: nový dodavatel vedlejší, s „jako hlavní“ přepne hlavního', async () => {
    loginAs(adminId)
    const r1 = await bulkPost(json({ productIds: [productA, productB], dodavatelId: dodavatelY }))
    expect(r1.status).toBe(200)
    expect(await r1.json()).toMatchObject({ pridano: 2 })
    // A už hlavního (X) má → Y vedlejší; B žádného neměl → Y hlavní
    expect(await vazby(productA)).toEqual([{ dodavatelId: dodavatelX, hlavni: true }, { dodavatelId: dodavatelY, hlavni: false }])
    expect(await vazby(productB)).toEqual([{ dodavatelId: dodavatelY, hlavni: true }])

    const r2 = await bulkPost(json({ productIds: [productA], dodavatelId: dodavatelY, hlavni: true }))
    expect(await r2.json()).toMatchObject({ pridano: 0, hlavnich: 1 })
    expect(await vazby(productA)).toEqual([{ dodavatelId: dodavatelX, hlavni: false }, { dodavatelId: dodavatelY, hlavni: true }])
  })

  it('cizí produkt → 404 a nic se nezapíše; bez práva katalogu 403', async () => {
    loginAs(adminId)
    const res = await bulkPost(json({ productIds: [productB, ciziProduct], dodavatelId: dodavatelX }))
    expect(res.status).toBe(404)
    expect(await vazby(ciziProduct)).toEqual([])
    expect((await vazby(productB)).some(v => v.dodavatelId === dodavatelX)).toBe(false)

    loginAs(adminId, 'TECHNIK')
    expect((await bulkPost(json({ productIds: [productB], dodavatelId: dodavatelX }))).status).toBe(403)
  })
})
