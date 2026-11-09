import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { odpovidaHledani } from '@/lib/hledani'
import { najdiKlientIds, najdiIdsBezDiakritiky } from '@/lib/clientSearch'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
import { getServerSession } from 'next-auth'
import { GET as clientsGet } from '@/app/api/clients/route'

const RUN = `hledani-${Date.now()}`
let orgId: string
let cizíOrgId: string
let kuncicky: string
let novak: string
let zakazkaId: string
let leadId: string

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Hledání', slug: RUN, plan: 'STANDARD' } })
  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi`, plan: 'STANDARD' } })
  orgId = org.id
  cizíOrgId = cizi.id
  kuncicky = (await prisma.client.create({ data: { orgId, jmeno: 'Radek', prijmeni: 'Kunčický', telefon: '777 123 456' } })).id
  novak = (await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák', email: 'jan@x.cz' } })).id
  await prisma.client.create({ data: { orgId: cizíOrgId, jmeno: 'Petr', prijmeni: 'Kunčický' } })
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-Z1`, klientId: novak, nazev: 'Tepelné čerpadlo Šťáhlavy', mistoStavby: 'Žďár nad Sázavou' } })).id
  leadId = (await prisma.lead.create({ data: { orgId, jmeno: 'Jiří Dvořák', firma: 'Řezníkův dvůr', telefon: '602 111 222' } })).id
  const user = await prisma.user.create({ data: { orgId, jmeno: 'A', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, orgId, role: 'ADMIN' } } as never)
})

afterAll(async () => {
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.lead.deleteMany({ where: { orgId } })
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

describe('najdiIdsBezDiakritiky (zakázky, leady, …)', () => {
  const db = () => orgPrisma(orgId)
  it('zakázka podle názvu/místa bez diakritiky, i v kombinaci s klientem', async () => {
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'zakazka', 'cerpadlo stahlavy')).toEqual([zakazkaId])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'zakazka', 'zdar')).toEqual([zakazkaId])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'zakazka', 'novak tepelne')).toEqual([zakazkaId])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'zakazka', 'kuncicky tepelne')).toEqual([])
  })
  it('lead podle jména, firmy a telefonu bez mezer', async () => {
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'lead', 'dvorak')).toEqual([leadId])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'lead', 'reznikuv')).toEqual([leadId])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'lead', '602111')).toEqual([leadId])
  })
  it('cizí org nevidí, prázdný dotaz = null', async () => {
    expect(await najdiIdsBezDiakritiky(orgPrisma(cizíOrgId), cizíOrgId, 'zakazka', 'cerpadlo')).toEqual([])
    expect(await najdiIdsBezDiakritiky(db(), orgId, 'lead', ' ')).toBeNull()
  })
})
