import { describe, it, expect, beforeAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { PATCH as leadPatch } from '@/app/api/leady/[id]/route'
import { getServerSession } from 'next-auth'

const RUN = `leady-patch-${Date.now()}`

let orgId: string
let obchodnikId: string
let leadId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Leady Patch', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const obchodnik = await prisma.user.create({
    data: { orgId, jmeno: 'Petr Obchodník', email: `petr-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  obchodnikId = obchodnik.id
  const lead = await prisma.lead.create({ data: { orgId, jmeno: 'Nepřiřazený lead' } })
  leadId = lead.id

  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: obchodnikId, orgId, role: 'ADMIN' },
  } as never)
})

function req(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/leady/${leadId}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('PATCH /api/leady/[id]', () => {
  it('přiřazení obchodníka vrátí i naplněnou relaci assignedTo, ne jen assignedToId', async () => {
    const res = await leadPatch(req({ assignedToId: obchodnikId }), { params: { id: leadId } })
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.assignedToId).toBe(obchodnikId)
    expect(data.assignedTo?.id).toBe(obchodnikId)
    expect(data.assignedTo?.jmeno).toBe('Petr Obchodník')
  })

  it('zrušení přiřazení vrátí assignedTo: null', async () => {
    await leadPatch(req({ assignedToId: obchodnikId }), { params: { id: leadId } })
    const res = await leadPatch(req({ assignedToId: null }), { params: { id: leadId } })
    const data = await res.json()
    expect(data.assignedToId).toBeNull()
    expect(data.assignedTo).toBeNull()
  })
})
