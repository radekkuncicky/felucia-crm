import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { checkDealLimit, checkUserLimit } from '@/lib/checkPlanLimit'
import { PLAN_LIMITS } from '@/lib/planLimits'

/**
 * Integrační test plan limitů nad nanto_crm_test.
 * STARTER: 1 user, 20 OP — ověřuje hranici i odemčení po upgrade.
 */

const RUN = `plan-${Date.now()}`

let org: { id: string }
let client: { id: string }

beforeAll(async () => {
  org = await prisma.organization.create({
    data: { nazev: 'Plan Test Org', slug: RUN, plan: 'STARTER' },
  })
  client = await prisma.client.create({
    data: { orgId: org.id, jmeno: 'Plan', prijmeni: 'Tester' },
  })
})

afterAll(async () => {
  await prisma.deal.deleteMany({ where: { orgId: org.id } })
  await prisma.user.deleteMany({ where: { orgId: org.id } })
  await prisma.client.deleteMany({ where: { orgId: org.id } })
  await prisma.organization.delete({ where: { id: org.id } })
  await prisma.$disconnect()
})

describe('limit obchodních případů', () => {
  it('pod limitem STARTER povolí vytvoření', async () => {
    expect(await checkDealLimit(org.id)).toBe(true)
  })

  it('na limitu STARTER (20 OP) zablokuje', async () => {
    await prisma.deal.createMany({
      data: Array.from({ length: PLAN_LIMITS.STARTER.maxDeals }, () => ({
        orgId: org.id,
        clientId: client.id,
        technologie: 'KLIMA' as const,
      })),
    })
    expect(await checkDealLimit(org.id)).toBe(false)
  })

  it('upgrade na STANDARD limit odemkne', async () => {
    await prisma.organization.update({
      where: { id: org.id },
      data: { plan: 'STANDARD' },
    })
    expect(await checkDealLimit(org.id)).toBe(true)
    await prisma.organization.update({
      where: { id: org.id },
      data: { plan: 'STARTER' },
    })
  })

  it('neexistující org limit nepovolí', async () => {
    expect(await checkDealLimit('neexistujici-org-id')).toBe(false)
  })
})

describe('limit uživatelů', () => {
  it('STARTER povolí prvního usera, druhého zablokuje', async () => {
    expect(await checkUserLimit(org.id)).toBe(true)
    await prisma.user.create({
      data: {
        orgId: org.id,
        email: `${RUN}@test.local`,
        jmeno: 'První User',
        hesloHash: 'x',
      },
    })
    expect(await checkUserLimit(org.id)).toBe(false)
  })
})
