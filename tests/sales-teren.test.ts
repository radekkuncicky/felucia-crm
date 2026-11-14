import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { rm } from 'fs/promises'
import { join } from 'path'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as pripadyPost } from '@/app/api/mobile/obchod/pripady/route'
import { POST as aktivityPost } from '@/app/api/mobile/obchod/aktivity/route'
import { parseMobileId } from '@/lib/mobileIdempotence'

/**
 * Přestavba Felucia Sales pro terén: idempotence offline fronty (mobileId),
 * fotky k OP, místo stavby, offline nový OP.
 */

const RUN = `teren-${Date.now()}`

let orgId: string
let userId: string
let dealId: string

const jsonReq = (method: string, body?: unknown) =>
  new Request('http://localhost/api/mobile/obchod/test', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Terén', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Olga Obchodní', email: `olga-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  userId = user.id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role: 'OBCHODNIK', plan: 'PROFESSIONAL' } } as never)

  const res = await pripadyPost(jsonReq('POST', {
    klient: { jmeno: 'Karel', prijmeni: 'Terénní', telefon: '+420777100200' },
    technologie: 'TEPELNE_CERPADLO',
  }))
  expect(res.status).toBe(201)
  dealId = (await res.json()).id
})

afterAll(async () => {
  if (dealId) await rm(join(process.cwd(), 'public', 'uploads', 'deals', dealId), { recursive: true, force: true }).catch(() => {})
  await prisma.photo.deleteMany({ where: { orgId } })
  await prisma.activity.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('idempotence mobileId', () => {
  it('parseMobileId přijme uuid, odmítne nesmysl', () => {
    expect(parseMobileId('3f0c3a4e-8d2b-4e43-9a51-1b2c3d4e5f60')).toBeTruthy()
    expect(parseMobileId('krátké')).toBeNull()
    expect(parseMobileId(42)).toBeNull()
  })

  it('opakovaný mobileId u aktivity vrátí 200 se stejným záznamem', async () => {
    const mobileId = `akt-${RUN}-1`
    const body = { dealId, typ: 'HOVOR', datum: '2026-11-14', splneno: true, vysledek: 'ok', mobileId }
    const r1 = await aktivityPost(jsonReq('POST', body))
    expect(r1.status).toBe(201)
    const r2 = await aktivityPost(jsonReq('POST', body))
    expect(r2.status).toBe(200)
    expect((await r2.json()).id).toBe((await r1.json()).id)
    expect(await prisma.activity.count({ where: { orgId, mobileId } })).toBe(1)
  })

  it('souběh dvou stejných požadavků založí jen jednu aktivitu (P2002)', async () => {
    const mobileId = `akt-${RUN}-2`
    const body = { dealId, typ: 'POZNAMKA', datum: '2026-11-14', popis: 'souběh', mobileId }
    const [a, b] = await Promise.all([aktivityPost(jsonReq('POST', body)), aktivityPost(jsonReq('POST', body))])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    const [ja, jb] = await Promise.all([a.json(), b.json()])
    expect(ja.id).toBe(jb.id)
    expect(await prisma.activity.count({ where: { orgId, mobileId } })).toBe(1)
  })
})
