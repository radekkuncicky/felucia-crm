import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Tenant izolace modelů Felucia Sales (Zamereni, ZamereniFoto,
 * ZamereniDefinice) — org A nesmí vidět ani změnit data org B.
 * ZamereniFoto nemá v orgPrisma extension where filtr přes rodiče
 * (scopuje se v routách přes `zamereni: { orgId }`), ale RLS ho musí
 * odstínit i při přímém dotazu.
 */

const RUN = `zam-iso-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let zamereniA: { id: string }
let zamereniB: { id: string }
let fotoB: { id: string }
let definiceB: { id: string }

beforeAll(async () => {
  orgA = await prisma.organization.create({
    data: { nazev: 'Zam Org A', slug: `${RUN}-a` },
  })
  orgB = await prisma.organization.create({
    data: { nazev: 'Zam Org B', slug: `${RUN}-b` },
  })

  const [dealA, dealB] = await Promise.all(
    [orgA, orgB].map(async (org, i) => {
      const client = await prisma.client.create({
        data: { orgId: org.id, jmeno: 'Klient', prijmeni: i ? 'B' : 'A' },
      })
      return prisma.deal.create({
        data: {
          orgId: org.id,
          clientId: client.id,
          technologie: 'TEPELNE_CERPADLO',
        },
      })
    })
  )

  zamereniA = await prisma.zamereni.create({
    data: { orgId: orgA.id, dealId: dealA.id, typ: 'TEPELNE_CERPADLO' },
  })
  zamereniB = await prisma.zamereni.create({
    data: { orgId: orgB.id, dealId: dealB.id, typ: 'KLIMA' },
  })
  fotoB = await prisma.zamereniFoto.create({
    data: {
      orgId: orgB.id,
      zamereniId: zamereniB.id,
      url: '/uploads/zamereni/test.jpg',
      tag: 'ROZVADEC',
    },
  })
  definiceB = await prisma.zamereniDefinice.create({
    data: {
      orgId: orgB.id,
      typ: 'KLIMA',
      nazev: 'Klima výchozí',
      schemaJson: { sekce: [] },
      povinneTagy: ['VNITRNI_JEDNOTKA'],
    },
  })
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.zamereniDefinice.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('Zamereni', () => {
  it('findMany vrací jen zaměření vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const rows = await db.zamereni.findMany()
    expect(rows.map((z) => z.id)).toEqual([zamereniA.id])
  })

  it('findUnique na cizí zaměření vrací null', async () => {
    const db = orgPrisma(orgA.id)
    expect(await db.zamereni.findUnique({ where: { id: zamereniB.id } })).toBeNull()
  })

  it('update cizího zaměření selže jako "not found"', async () => {
    const db = orgPrisma(orgA.id)
    await expect(
      db.zamereni.update({ where: { id: zamereniB.id }, data: { stav: 'UZAVRENE' } })
    ).rejects.toThrow()
  })

  it('create s cizím orgId vyhodí chybu', async () => {
    const db = orgPrisma(orgA.id)
    await expect(
      db.zamereni.create({
        data: { orgId: orgB.id, dealId: zamereniB.id, typ: 'KLIMA' },
      })
    ).rejects.toThrow(/cizím orgId/)
  })
})

describe('ZamereniFoto', () => {
  it('cizí fotka není vidět ani přes findMany', async () => {
    const db = orgPrisma(orgA.id)
    expect(await db.zamereniFoto.findMany()).toEqual([])
  })

  it('vztahový filtr přes rodiče nepustí k cizí fotce', async () => {
    const db = orgPrisma(orgA.id)
    const rows = await db.zamereniFoto.findMany({
      where: { zamereni: { orgId: orgB.id } },
    })
    expect(rows).toEqual([])
  })

  it('vlastní org svou fotku vidí', async () => {
    const db = orgPrisma(orgB.id)
    const rows = await db.zamereniFoto.findMany()
    expect(rows.map((f) => f.id)).toEqual([fotoB.id])
  })
})

describe('ZamereniDefinice', () => {
  it('cizí definice není vidět', async () => {
    const db = orgPrisma(orgA.id)
    expect(await db.zamereniDefinice.findMany()).toEqual([])
    expect(
      await db.zamereniDefinice.findUnique({ where: { id: definiceB.id } })
    ).toBeNull()
  })

  it('stejná kombinace typ+verze smí existovat v obou orgách', async () => {
    const db = orgPrisma(orgA.id)
    const vlastni = await db.zamereniDefinice.create({
      data: {
        orgId: orgA.id,
        typ: 'KLIMA',
        nazev: 'Klima výchozí',
        schemaJson: { sekce: [] },
      },
    })
    expect(vlastni.verze).toBe(1)
    await db.zamereniDefinice.delete({ where: { id: vlastni.id } })
  })
})
