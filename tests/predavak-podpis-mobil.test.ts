import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as podepsatPost } from '@/app/api/mobile/predavak/[predavakId]/podepsat/route'
import { getServerSession } from 'next-auth'

// Bug 2026-11-13: zaškrtnutí položek v appce se drželo jen lokálně, podpis kontroloval uložený stav
// → „Musí být zaškrtnuta aspoň 1 položka“. Podpis teď nese aktuální položky a uloží je spolu s ním.
const RUN = `pp-podpis-${Date.now()}`
let orgId: string
let technikId: string
let predavakId: string
let polozkaIds: string[]
let cizíPolozkaId: string

const req = (body: unknown) => new Request('http://test', { method: 'POST', body: JSON.stringify(body) })
const ctx = () => ({ params: { predavakId } })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test PP podpis', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const t = await prisma.user.create({ data: { orgId, jmeno: 'Tonda', email: `${RUN}@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  technikId = t.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'K', prijmeni: 'Klient' } })
  const z = await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-1`, nazev: 'TČ', klientId: klient.id, stav: 'V_REALIZACI', techniciRel: { create: { technikId } } } })
  const p = await prisma.predavak.create({
    data: {
      orgId, zakazkaId: z.id, cislo: `${RUN}-PP`, technikId,
      polozky: { create: [{ nazev: 'TČ', zahrnuto: false }, { nazev: 'Montáž', zahrnuto: false }] },
    },
    include: { polozky: true },
  })
  predavakId = p.id
  polozkaIds = p.polozky.map(x => x.id)
  const p2 = await prisma.predavak.create({
    data: { orgId, zakazkaId: z.id, cislo: `${RUN}-PP2`, technikId, polozky: { create: [{ nazev: 'Cizí', zahrnuto: false }] } },
    include: { polozky: true },
  })
  cizíPolozkaId = p2.polozky[0].id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: technikId, orgId, role: 'TECHNIK', plan: 'PROFESSIONAL', perms: ROLE_PRESETS.TECHNIK } } as never)
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('mobilní podpis předáváku', () => {
  it('bez zaškrtnuté položky (ani v DB, ani v těle) → 422', async () => {
    const r = await podepsatPost(req({ klientPritomen: false, polozky: [{ id: polozkaIds[0], zahrnuto: false }] }), ctx())
    expect(r.status).toBe(422)
  })

  it('cizí položka v těle se ignoruje', async () => {
    const r = await podepsatPost(req({ klientPritomen: false, polozky: [{ id: cizíPolozkaId, zahrnuto: true }] }), ctx())
    expect(r.status).toBe(422)
    expect((await prisma.predavakPolozka.findUniqueOrThrow({ where: { id: cizíPolozkaId } })).zahrnuto).toBe(false)
  })

  it('neuložené zaškrtnutí z appky se uloží spolu s podpisem', async () => {
    const r = await podepsatPost(req({
      klientPritomen: false,
      polozky: [{ id: polozkaIds[0], zahrnuto: true, mnozstviPouzito: 2 }, { id: polozkaIds[1], zahrnuto: false }],
    }), ctx())
    expect(r.status).toBe(200)
    const p = await prisma.predavak.findUniqueOrThrow({ where: { id: predavakId }, include: { polozky: true } })
    expect(p.stav).toBe('PODPISAN')
    const prvni = p.polozky.find(x => x.id === polozkaIds[0])!
    expect(prvni.zahrnuto).toBe(true)
    expect(Number(prvni.mnozstviPouzito)).toBe(2)
  })
})
