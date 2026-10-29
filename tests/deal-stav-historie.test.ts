import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Historie stavů OP (deal_stav_zmeny) — píše ji DB trigger při každé změně
 * stavu odkudkoli; kdo změnil, doplní trigger nad audit_logs.
 */

const RUN = `stavhist-${Date.now()}`
let orgA: { id: string }
let orgB: { id: string }
let userId: string
let dealId: string

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Historie A', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'Historie B', slug: `${RUN}-b` } })
  userId = (await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Změnil', email: `${RUN}@test.cz`, hesloHash: 'x', role: 'ADMIN' } })).id
  const k = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jan', prijmeni: 'Stav' } })
  dealId = (await orgPrisma(orgA.id).deal.create({ data: { orgId: orgA.id, clientId: k.id, kod: `${RUN}-1`, technologie: 'KLIMA' } })).id
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

const historie = () => prisma.dealStavZmena.findMany({ where: { dealId }, orderBy: { vytvoreno: 'asc' } })

describe('trigger deal_stav_zmeny', () => {
  it('založení OP zapíše počáteční stav', async () => {
    const h = await historie()
    expect(h).toHaveLength(1)
    expect(h[0]).toMatchObject({ orgId: orgA.id, zStavu: null, naStav: 'NOVY' })
  })

  it('změna stavu pod RLS (orgPrisma) zapíše z → na, jiná změna nic', async () => {
    const db = orgPrisma(orgA.id)
    await db.deal.update({ where: { id: dealId }, data: { stav: 'NABIDKA' } })
    await db.deal.update({ where: { id: dealId }, data: { predmet: 'Jen předmět' } })
    await db.deal.update({ where: { id: dealId }, data: { stav: 'NABIDKA' } })
    const h = await historie()
    expect(h).toHaveLength(2)
    expect(h[1]).toMatchObject({ zStavu: 'NOVY', naStav: 'NABIDKA', zmenilId: null })
  })

  it('audit log se změnou stavu doplní, kdo změnil', async () => {
    await orgPrisma(orgA.id).auditLog.create({
      data: { orgId: orgA.id, userId, typAkce: 'UPDATE', typZaznamu: 'Deal', zaznamId: dealId, zaznamNazev: '', zmeny: { stav: { z: 'NOVY', na: 'NABIDKA' } } },
    })
    const h = await historie()
    expect(h[1].zmenilId).toBe(userId)
    expect(h[0].zmenilId).toBeNull()
  })

  it('historie cizí firmy není vidět (RLS + orgPrisma)', async () => {
    expect(await orgPrisma(orgB.id).dealStavZmena.findMany({ where: { dealId } })).toHaveLength(0)
    expect(await orgPrisma(orgA.id).dealStavZmena.count({ where: { dealId } })).toBe(2)
  })
})
