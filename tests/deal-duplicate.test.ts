import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as duplicatePost } from '@/app/api/deals/[id]/duplicate/route'

const RUN = `dupop-${Date.now()}`
let orgId: string
let dealId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test duplikace OP', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Ada Admin', email: `ada-${RUN}@example.cz`, role: 'ADMIN', hesloHash: 'x' },
  })
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: user.id, orgId, role: 'ADMIN', plan: 'PROFESSIONAL' },
  } as never)
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Kopírka' } })
  const yr = String(new Date().getFullYear() % 100).padStart(2, '0')
  const deal = await prisma.deal.create({
    data: { orgId, clientId: client.id, userId: user.id, kod: `OP-${yr}-007`, technologie: 'KLIMA', predmet: 'Klima obývák' },
  })
  dealId = deal.id
})

afterAll(async () => {
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId } } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('duplikace OP', () => {
  it('kopie dostane další číslo OP z řady', async () => {
    const res = await duplicatePost(new Request('http://localhost/x', { method: 'POST' }), { params: { id: dealId } })
    expect(res.status).toBe(201)
    const kopie = await res.json()
    const yr = String(new Date().getFullYear() % 100).padStart(2, '0')
    expect(kopie.kod).toBe(`OP-${yr}-008`)
    expect(kopie.predmet).toBe('Klima obývák (kopie)')

    const res2 = await duplicatePost(new Request('http://localhost/x', { method: 'POST' }), { params: { id: dealId } })
    expect((await res2.json()).kod).toBe(`OP-${yr}-009`)
  })
})
