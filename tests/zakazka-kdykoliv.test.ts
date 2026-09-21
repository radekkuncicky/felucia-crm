import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { PATCH } from '@/app/api/zakazky/[id]/route'
import { getServerSession } from 'next-auth'

const RUN = `kdykoliv-${Date.now()}`

let orgId: string
let adminId: string
let technikId: string
let zakazkaId: string

function loginAs(userId: string, role: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role } } as never)
}

function patch(body: Record<string, unknown>) {
  return PATCH(new Request('http://test', { method: 'PATCH', body: JSON.stringify(body) }), { params: { id: zakazkaId } })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Kdykoliv', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const technik = await prisma.user.create({
    data: { orgId, jmeno: 'Tonda Technik', email: `${RUN}-technik@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })
  technikId = technik.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const zakazka = await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-ZAK-001`, nazev: 'Výplňová zakázka', klientId: klient.id, vedouciId: adminId,
      techniciRel: { create: [{ technikId }] },
    },
  })
  zakazkaId = zakazka.id
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('Zakazka.kdykoliv (PATCH /api/zakazky/[id])', () => {
  it('výchozí hodnota je false', async () => {
    const z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(false)
  })

  it('admin příznak zapne a vypne, termín zůstává prázdný', async () => {
    loginAs(adminId, 'ADMIN')
    let res = await patch({ kdykoliv: true })
    expect(res.status).toBe(200)
    let z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(true)
    expect(z.montazOd).toBeNull()

    res = await patch({ kdykoliv: false })
    expect(res.status).toBe(200)
    z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(false)
  })

  it('PATCH bez klíče kdykoliv příznak nemění', async () => {
    loginAs(adminId, 'ADMIN')
    await patch({ kdykoliv: true })
    const res = await patch({ nazev: 'Přejmenovaná' })
    expect(res.status).toBe(200)
    const z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(true)
    expect(z.nazev).toBe('Přejmenovaná')
  })

  it('nebooleovská hodnota se ignoruje', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await patch({ kdykoliv: 'ano' })
    expect(res.status).toBe(200)
    const z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(true)
  })

  it('technik bez zakazkyEdit dostane 403 a příznak se nezmění', async () => {
    loginAs(technikId, 'TECHNIK')
    const res = await patch({ kdykoliv: false })
    expect(res.status).toBe(403)
    const z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(true)
  })

  it('drop z poolu: nastavení termínu příznak zachová', async () => {
    loginAs(adminId, 'ADMIN')
    const iso = new Date('2026-10-05').toISOString()
    const res = await patch({ montazOd: iso, montazDo: iso })
    expect(res.status).toBe(200)
    const z = await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })
    expect(z.kdykoliv).toBe(true)
    expect(z.montazOd?.toISOString()).toBe(iso)
  })
})
