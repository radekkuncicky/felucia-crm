import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as checkDuplicate } from '@/app/api/clients/check-duplicate/route'
import { getServerSession } from 'next-auth'

const RUN = `dup-check-${Date.now()}`

let orgAId: string
let orgBId: string

beforeAll(async () => {
  const orgA = await prisma.organization.create({ data: { nazev: 'Test Dup A', slug: `${RUN}-a` } })
  orgAId = orgA.id
  const orgB = await prisma.organization.create({ data: { nazev: 'Test Dup B', slug: `${RUN}-b` } })
  orgBId = orgB.id

  await prisma.client.create({
    data: { orgId: orgAId, jmeno: 'Jan', prijmeni: 'Novák', telefon: '777123456', email: 'jan@novak.cz' },
  })
  // stejný telefon v jiné organizaci — nesmí se počítat jako shoda
  await prisma.client.create({
    data: { orgId: orgBId, jmeno: 'Cizí', prijmeni: 'Klient', telefon: '777123456', email: 'cizi@example.com' },
  })
})

afterAll(async () => {
  await prisma.client.deleteMany({ where: { orgId: { in: [orgAId, orgBId] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgAId, orgBId] } } })
  await prisma.$disconnect()
})

function post(orgId: string, body: Record<string, unknown>) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: 'u1', orgId, role: 'OBCHODNIK' } } as never)
  return new Request('http://localhost/api/clients/check-duplicate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/clients/check-duplicate', () => {
  it('najde shodu podle telefonu v rámci stejné organizace', async () => {
    const res = await checkDuplicate(post(orgAId, { telefon: '+420 777 123 456' }))
    expect(res.status).toBe(200)
    const { match } = await res.json()
    expect(match?.jmeno).toBe('Jan')
  })

  it('nenajde shodu napříč organizacemi (stejný telefon, jiný tenant)', async () => {
    const res = await checkDuplicate(post(orgAId, { telefon: '777123456' }))
    const { match } = await res.json()
    expect(match?.email).toBe('jan@novak.cz') // sanity: patří orgA klientovi
    expect(match?.email).not.toBe('cizi@example.com')
  })

  it('bez shody vrátí match: null', async () => {
    const res = await checkDuplicate(post(orgAId, { jmeno: 'Zcela', prijmeni: 'Jiný' }))
    const { match } = await res.json()
    expect(match).toBeNull()
  })

  it('bez session vrátí 401', async () => {
    vi.mocked(getServerSession).mockResolvedValue(null as never)
    const res = await checkDuplicate(new Request('http://localhost/api/clients/check-duplicate', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    }))
    expect(res.status).toBe(401)
  })
})
