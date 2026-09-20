import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma, prismaApp, rlsActive } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Integrační test Row Level Security (prisma/rls.sql) nad nanto_crm_test.
 *
 * Na rozdíl od tenant-isolation.test.ts (aplikační vrstva orgPrisma) tady
 * testujeme přímo DB vrstvu: prismaApp (role nanto_app, BEZ scoping
 * extension) se explicitně ptá na cizí data a RLS je musí zadržet.
 */

const RUN = `rls-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let clientB: { id: string }

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'RLS Org A', slug: `${RUN}-a` } })
  orgB = await prisma.organization.create({ data: { nazev: 'RLS Org B', slug: `${RUN}-b` } })
  clientB = await prisma.client.create({
    data: { orgId: orgB.id, jmeno: 'Bára', prijmeni: 'Banán' },
  })
})

afterAll(async () => {
  await prisma.client.deleteMany({ where: { orgId: { in: [orgA.id, orgB.id] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id] } } })
  await prisma.$disconnect()
})

describe('prostředí', () => {
  it('RLS je v testech aktivní (RLS_DB_* v .env)', () => {
    expect(rlsActive).toBe(true)
  })

  it('Prisma extension dostává __internalParams.transaction (interní API, na kterém stojí orgPrisma)', async () => {
    let single: unknown = 'nezavoláno'
    let inItx: unknown = 'nezavoláno'
    const probe = prisma.$extends({
      query: {
        $allModels: {
          async $allOperations(params) {
            const tx = (params as unknown as { __internalParams?: { transaction?: unknown } })
              .__internalParams?.transaction
            if (single === 'nezavoláno') single = tx
            else inItx = tx
            return params.query(params.args)
          },
        },
      },
    })
    await probe.organization.findFirst({ where: { id: orgA.id } })
    await probe.$transaction(async (tx) => {
      await tx.organization.findFirst({ where: { id: orgA.id } })
    })
    expect(single).toBeUndefined()
    expect(inItx).toMatchObject({ kind: 'itx' })
  })
})

describe('DB vrstva (nanto_app bez aplikačního scopingu)', () => {
  it('bez kontextu nevrátí nic (fail-closed)', async () => {
    const rows = await prismaApp.client.findMany({ where: { orgId: orgB.id } })
    expect(rows).toEqual([])
  })

  it('s kontextem org A nevrátí data org B ani při explicitním where', async () => {
    const [, rows] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA.id}, true)`,
      prismaApp.client.findMany({ where: { orgId: orgB.id } }),
    ])
    expect(rows).toEqual([])
  })

  it('s kontextem org A nejde vytvořit záznam org B (WITH CHECK)', async () => {
    await expect(
      prismaApp.$transaction([
        prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA.id}, true)`,
        prismaApp.client.create({
          data: { orgId: orgB.id, jmeno: 'Pašerák', prijmeni: 'Cizí' },
        }),
      ])
    ).rejects.toThrow()
  })

  it('s kontextem org A nejde updatovat záznam org B', async () => {
    const [, res] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA.id}, true)`,
      prismaApp.client.updateMany({ where: { id: clientB.id }, data: { jmeno: 'Hacknuto' } }),
    ])
    expect((res as { count: number }).count).toBe(0)
    const fresh = await prisma.client.findUnique({ where: { id: clientB.id } })
    expect(fresh?.jmeno).toBe('Bára')
  })

  it('LIMIT VRSTVY: FK na cizí org RLS nekontroluje — create s clientId org B pod kontextem org A projde', async () => {
    // Dokumentované chování PostgreSQL: kontroly referenční integrity RLS obcházejí.
    // Vlastnictví FK z těla requestu proto musí ověřit aplikace (viz SEC-08 v
    // docs/SECURITY_AUDIT_2026-09.md); tenhle test hlídá, že o tom víme.
    const [, deal] = await prismaApp.$transaction([
      prismaApp.$executeRaw`SELECT set_config('app.org_id', ${orgA.id}, true)`,
      prismaApp.deal.create({ data: { orgId: orgA.id, clientId: clientB.id, technologie: 'KLIMA' } }),
    ])
    expect(deal.clientId).toBe(clientB.id)
    await prisma.deal.delete({ where: { id: deal.id } })
  })

  it('owner klient (bare prisma) RLS nepodléhá — auth/superadmin toky fungují', async () => {
    const rows = await prisma.client.findMany({ where: { orgId: orgB.id } })
    expect(rows.map((r) => r.id)).toEqual([clientB.id])
  })
})

describe('orgPrisma pod RLS', () => {
  it('běžné operace fungují (batch wrap se set_config)', async () => {
    const db = orgPrisma(orgB.id)
    const rows = await db.client.findMany()
    expect(rows.map((r) => r.id)).toEqual([clientB.id])
    expect(await db.client.count()).toBe(1)
  })

  it('interaktivní transakce funguje a je org-scoped', async () => {
    const db = orgPrisma(orgB.id)
    const created = await db.$transaction(async (tx) => {
      const c = await tx.client.create({
        data: { orgId: orgB.id, jmeno: 'Tx', prijmeni: 'Test' },
      })
      return tx.client.findUnique({ where: { id: c.id } })
    })
    expect(created?.jmeno).toBe('Tx')
    await prisma.client.delete({ where: { id: created!.id } })
  })

  it('batch transakce funguje a vrací výsledky bez posunu indexů', async () => {
    const db = orgPrisma(orgB.id)
    const [count, first] = await db.$transaction([
      db.client.count(),
      db.client.findFirst({ where: { prijmeni: 'Banán' } }),
    ])
    expect(count).toBe(1)
    expect((first as { id: string } | null)?.id).toBe(clientB.id)
  })

  it('transakce nevidí data cizí org', async () => {
    const db = orgPrisma(orgA.id)
    const found = await db.$transaction(async (tx) => {
      return tx.client.findMany({ where: { orgId: orgB.id } })
    })
    expect(found).toEqual([])
  })
})
