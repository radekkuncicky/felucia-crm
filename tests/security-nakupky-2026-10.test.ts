import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { maskNakupky } from '@/lib/maskNakupky'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { GET as zakazkaGet, DELETE as zakazkaDelete } from '@/app/api/zakazky/[id]/route'
import { POST as polozkaPost } from '@/app/api/zakazky/[id]/polozky/route'
import { DELETE as vyuctovaniDelete } from '@/app/api/vyuctovani/[id]/route'
import { PATCH as productPatch } from '@/app/api/products/[id]/route'

// Bezpečnostní nálezy 2026-10-01 (úniky nákupek, katalog, cizí ID, mazání zakázky)
const RUN = `sec-nakupky-${Date.now()}`

let orgId: string
let cizíOrgId: string
let adminId: string
let klientId: string
let productId: string
let cizíProductId: string

function login(role: keyof typeof ROLE_PRESETS, perms = ROLE_PRESETS[role]) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role, perms } } as never)
}

let cislo = 0
async function novaZakazka() {
  return prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-${++cislo}`, klientId, nazev: 'Test' } })
}

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Sec Nákupky', slug: RUN } })).id
  cizíOrgId = (await prisma.organization.create({ data: { nazev: 'Sec Nákupky cizí', slug: `${RUN}-x` } })).id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })).id
  klientId = (await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })).id
  productId = (await prisma.product.create({
    data: { orgId, nazev: 'Jednotka', standardniCena: 25000, nakladovaCena: 18000 },
  })).id
  cizíProductId = (await prisma.product.create({
    data: { orgId: cizíOrgId, nazev: 'Cizí', standardniCena: 1 },
  })).id
})

afterAll(async () => {
  for (const id of [orgId, cizíOrgId]) {
    await prisma.auditLog.deleteMany({ where: { orgId: id } })
    await prisma.skladPohyb.deleteMany({ where: { orgId: id } })
    await prisma.vyuctovani.deleteMany({ where: { orgId: id } })
    await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId: id } } })
    await prisma.zakazka.deleteMany({ where: { orgId: id } })
    await prisma.product.deleteMany({ where: { orgId: id } })
    await prisma.client.deleteMany({ where: { orgId: id } })
    await prisma.user.deleteMany({ where: { orgId: id } })
    await prisma.organization.delete({ where: { id } })
  }
})

describe('maskNakupky', () => {
  it('vynuluje nákupky i ve vnořených include, Decimal a Date nechá', () => {
    const d = new Date()
    const data = {
      cena: new Prisma.Decimal(5),
      vytvoreno: d,
      polozky: [{ nakupniCena: new Prisma.Decimal(10), product: { nakladovaCena: 7, nazev: 'X' } }],
    }
    const out = maskNakupky(data, { financeNakupky: false })
    expect(out.polozky[0].nakupniCena).toBeNull()
    expect(out.polozky[0].product.nakladovaCena).toBeNull()
    expect(out.polozky[0].product.nazev).toBe('X')
    expect(out.cena).toBeInstanceOf(Prisma.Decimal)
    expect(out.vytvoreno).toBe(d)
    expect(maskNakupky(data, { financeNakupky: true })).toBe(data)
  })
})

describe('zakázka — nákupky a cizí ID', () => {
  it('GET /api/zakazky/[id] bez financeNakupky nevrací nakupniCena položek', async () => {
    const z = await novaZakazka()
    await prisma.zakazkaPolozka.create({ data: { zakazkaId: z.id, nazev: 'P', nakupniCena: 999, prodejniCena: 1500 } })
    login('MANAZER', { ...ROLE_PRESETS.MANAZER, financeNakupky: false })
    const res = await zakazkaGet(new Request('http://t'), { params: { id: z.id } })
    const body = await res.json()
    expect(body.polozky[0].nakupniCena).toBeNull()
    expect(Number(body.polozky[0].prodejniCena)).toBe(1500)
  })

  it('POST položky s cizím productId uloží položku bez produktu', async () => {
    const z = await novaZakazka()
    login('ADMIN')
    const res = await polozkaPost(
      new Request('http://t', { method: 'POST', body: JSON.stringify({ nazev: 'X', productId: cizíProductId }) }),
      { params: { id: z.id } },
    )
    expect(res.status).toBe(201)
    expect((await res.json()).productId).toBeNull()
  })
})

describe('katalog bez oprávnění', () => {
  it('PATCH /api/products/[id] jako OBCHODNIK → 403', async () => {
    login('OBCHODNIK')
    const res = await productPatch(
      new Request('http://t', { method: 'PATCH', body: JSON.stringify({}) }),
      { params: { id: productId } },
    )
    expect(res.status).toBe(403)
  })
})

describe('mazání zakázky a vyúčtování', () => {
  it('zakázku s výdejem materiálu nelze smazat', async () => {
    const z = await novaZakazka()
    await prisma.skladPohyb.create({
      data: { orgId, zakazkaId: z.id, typ: 'VYDEJ', nazev: 'Měď', mnozstvi: 1, vytvorilId: adminId },
    })
    login('ADMIN')
    const res = await zakazkaDelete(new Request('http://t'), { params: { id: z.id } })
    expect(res.status).toBe(422)
    expect(await prisma.zakazka.count({ where: { id: z.id } })).toBe(1)
  })

  it('zakázku jen s rezervací smaže a zapíše do auditu', async () => {
    const z = await novaZakazka()
    await prisma.skladPohyb.create({
      data: { orgId, zakazkaId: z.id, typ: 'REZERVACE', nazev: 'Měď', mnozstvi: 1, vytvorilId: adminId },
    })
    login('ADMIN')
    const res = await zakazkaDelete(new Request('http://t'), { params: { id: z.id } })
    expect(res.status).toBe(200)
    expect(await prisma.zakazka.count({ where: { id: z.id } })).toBe(0)
    expect(await prisma.auditLog.count({ where: { orgId, zaznamId: z.id, typAkce: 'DELETE' } })).toBe(1)
  })

  it('schválené vyúčtování nelze smazat', async () => {
    const z = await novaZakazka()
    const v = await prisma.vyuctovani.create({ data: { orgId, zakazkaId: z.id, cislo: `${RUN}-V`, stav: 'SCHVALENO' } })
    login('ADMIN')
    const res = await vyuctovaniDelete(new Request('http://t'), { params: { id: v.id } })
    expect(res.status).toBe(422)
    expect(await prisma.vyuctovani.count({ where: { id: v.id } })).toBe(1)
  })
})
