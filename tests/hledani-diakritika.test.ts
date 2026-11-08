import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { odpovidaHledani } from '@/lib/hledani'
import { najdiKlientIds } from '@/lib/clientSearch'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'
import { GET as clientsGet } from '@/app/api/clients/route'

const RUN = `hledani-${Date.now()}`
let orgId: string
let cizíOrgId: string
let kuncicky: string
let novak: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Hledání', slug: RUN, plan: 'STANDARD' } })
  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi`, plan: 'STANDARD' } })
  orgId = org.id
  cizíOrgId = cizi.id
  kuncicky = (await prisma.client.create({ data: { orgId, jmeno: 'Radek', prijmeni: 'Kunčický', telefon: '777 123 456' } })).id
  novak = (await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák', email: 'jan@x.cz' } })).id
  await prisma.client.create({ data: { orgId: cizíOrgId, jmeno: 'Petr', prijmeni: 'Kunčický' } })
  const user = await prisma.user.create({ data: { orgId, jmeno: 'A', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, orgId, role: 'ADMIN' } } as never)
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId: { in: [orgId, cizíOrgId] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, cizíOrgId] } } })
  await prisma.$disconnect()
})

describe('odpovidaHledani (UI)', () => {
  it('ignoruje diakritiku, velikost písmen a pořadí slov', () => {
    expect(odpovidaHledani('kuncicky', 'Radek', 'Kunčický')).toBe(true)
    expect(odpovidaHledani('KUNČ', 'Radek', 'Kuncicky')).toBe(true)
    expect(odpovidaHledani('novak jan', 'Jan', 'Novák')).toBe(true)
    expect(odpovidaHledani('novak petr', 'Jan', 'Novák')).toBe(false)
    expect(odpovidaHledani('777123', '777 123 456')).toBe(true)
    expect(odpovidaHledani('', 'cokoli')).toBe(true)
  })
})

describe('najdiKlientIds (DB, unaccent + RLS)', () => {
  it('najde bez diakritiky jen v rámci org', async () => {
    const ids = await najdiKlientIds(orgPrisma(orgId), orgId, 'kuncicky')
    expect(ids).toEqual([kuncicky])
  })
  it('celé jméno v libovolném pořadí, telefon bez mezer', async () => {
    expect(await najdiKlientIds(orgPrisma(orgId), orgId, 'novák jan')).toEqual([novak])
    expect(await najdiKlientIds(orgPrisma(orgId), orgId, '777123456')).toEqual([kuncicky])
  })
  it('% a _ v dotazu nejsou zástupné znaky', async () => {
    expect(await najdiKlientIds(orgPrisma(orgId), orgId, '%')).toEqual([])
  })
  it('prázdný dotaz = nefiltrovat', async () => {
    expect(await najdiKlientIds(orgPrisma(orgId), orgId, '  ')).toBeNull()
  })
  it('GET /api/clients?search=kuncicky', async () => {
    const res = await clientsGet(new Request('http://localhost/api/clients?search=kuncicky'))
    const data = await res.json()
    expect(data.map((c: { id: string }) => c.id)).toEqual([kuncicky])
  })
})
