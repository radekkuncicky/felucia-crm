import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Integrační test tenant izolace nad nanto_crm_test.
 * Dvě organizace, každá má klienta — org A nesmí žádnou operací
 * vidět ani změnit data org B.
 */

const RUN = `iso-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let clientA: { id: string }
let clientB: { id: string }

beforeAll(async () => {
  orgA = await prisma.organization.create({
    data: { nazev: 'Test Org A', slug: `${RUN}-a` },
  })
  orgB = await prisma.organization.create({
    data: { nazev: 'Test Org B', slug: `${RUN}-b` },
  })
  clientA = await prisma.client.create({
    data: { orgId: orgA.id, jmeno: 'Adam', prijmeni: 'Ananas' },
  })
  clientB = await prisma.client.create({
    data: { orgId: orgB.id, jmeno: 'Bára', prijmeni: 'Banán' },
  })
})

afterAll(async () => {
  await prisma.client.deleteMany({
    where: { orgId: { in: [orgA.id, orgB.id] } },
  })
  await prisma.organization.deleteMany({
    where: { id: { in: [orgA.id, orgB.id] } },
  })
  await prisma.$disconnect()
})

describe('čtení', () => {
  it('findMany vrací jen záznamy vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const clients = await db.client.findMany()
    expect(clients.map((c) => c.id)).toEqual([clientA.id])
  })

  it('findUnique na cizí záznam vrací null', async () => {
    const db = orgPrisma(orgA.id)
    const found = await db.client.findUnique({ where: { id: clientB.id } })
    expect(found).toBeNull()
  })

  it('count počítá jen vlastní záznamy', async () => {
    const db = orgPrisma(orgA.id)
    expect(await db.client.count()).toBe(1)
  })

  it('ručně podvržený cizí orgId ve where nic nevrátí', async () => {
    const db = orgPrisma(orgA.id)
    const clients = await db.client.findMany({ where: { orgId: orgB.id } })
    expect(clients).toEqual([])
  })

  it('groupBy je scopované na vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const groups = await db.client.groupBy({
      by: ['orgId'],
      _count: true,
    })
    expect(groups).toEqual([{ orgId: orgA.id, _count: 1 }])
  })
})

describe('zápis', () => {
  it('update cizího záznamu selže jako "not found"', async () => {
    const db = orgPrisma(orgA.id)
    await expect(
      db.client.update({
        where: { id: clientB.id },
        data: { jmeno: 'Hacknuto' },
      })
    ).rejects.toThrow()
    const intact = await prisma.client.findUnique({
      where: { id: clientB.id },
    })
    expect(intact?.jmeno).toBe('Bára')
  })

  it('delete cizího záznamu selže a záznam zůstane', async () => {
    const db = orgPrisma(orgA.id)
    await expect(
      db.client.delete({ where: { id: clientB.id } })
    ).rejects.toThrow()
    expect(
      await prisma.client.findUnique({ where: { id: clientB.id } })
    ).not.toBeNull()
  })

  it('updateMany bez where zasáhne jen vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const res = await db.client.updateMany({ data: { poznamka: 'hromadná' } })
    expect(res.count).toBe(1)
    const b = await prisma.client.findUnique({ where: { id: clientB.id } })
    expect(b?.poznamka).toBeNull()
  })

  it('deleteMany bez where smaže jen vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const temp = await db.client.create({
      data: { orgId: orgA.id, jmeno: 'Dočasný', prijmeni: 'Klient' },
    })
    const res = await db.client.deleteMany({
      where: { id: { in: [temp.id, clientB.id] } },
    })
    expect(res.count).toBe(1)
    expect(
      await prisma.client.findUnique({ where: { id: clientB.id } })
    ).not.toBeNull()
  })
})

describe('vytváření', () => {
  it('create doplní orgId automaticky (runtime, mimo typy)', async () => {
    const db = orgPrisma(orgA.id)
    // cast: typy Prismy orgId vyžadují, extension ho doplní za běhu
    const created = await db.client.create({
      data: { jmeno: 'Cyril', prijmeni: 'Citron' } as never,
    })
    expect(created.orgId).toBe(orgA.id)
    await prisma.client.delete({ where: { id: created.id } })
  })

  it('create s cizím orgId vyhodí chybu', async () => {
    const db = orgPrisma(orgA.id)
    await expect(
      db.client.create({
        data: { orgId: orgB.id, jmeno: 'Pod', prijmeni: 'Vrh' },
      })
    ).rejects.toThrow(/cizím orgId/)
  })

  it('createMany doplní orgId všem záznamům', async () => {
    const db = orgPrisma(orgA.id)
    await db.client.createMany({
      data: [
        { jmeno: 'David', prijmeni: 'Datle' },
        { jmeno: 'Eva', prijmeni: 'Eukalypt' },
      ] as never,
    })
    const count = await prisma.client.count({
      where: { orgId: orgA.id, prijmeni: { in: ['Datle', 'Eukalypt'] } },
    })
    expect(count).toBe(2)
    await prisma.client.deleteMany({
      where: { orgId: orgA.id, prijmeni: { in: ['Datle', 'Eukalypt'] } },
    })
  })

  it('upsert na cizí záznam ho nezmění, ale založí nový ve vlastní org', async () => {
    const db = orgPrisma(orgA.id)
    const res = await db.client.upsert({
      where: { id: clientB.id },
      update: { jmeno: 'Hacknuto' },
      create: { jmeno: 'Nový', prijmeni: 'Upsert' } as never,
    })
    expect(res.orgId).toBe(orgA.id)
    const b = await prisma.client.findUnique({ where: { id: clientB.id } })
    expect(b?.jmeno).toBe('Bára')
    await prisma.client.delete({ where: { id: res.id } })
  })
})

describe('netenant modely', () => {
  it('Organization extension nefiltruje (potřeba pro auth/superadmin)', async () => {
    const db = orgPrisma(orgA.id)
    const other = await db.organization.findUnique({ where: { id: orgB.id } })
    expect(other).not.toBeNull()
  })
})
