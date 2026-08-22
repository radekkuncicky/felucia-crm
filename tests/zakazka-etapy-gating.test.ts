import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as etapyPost } from '@/app/api/zakazky/[id]/etapy/route'
import { POST as predavakyPost } from '@/app/api/predavaky/route'
import { POST as schvalitPost } from '@/app/api/predavaky/[id]/schvalit/route'
import { POST as vyuSchvalitPost } from '@/app/api/vyuctovani/[id]/schvalit/route'
import { getServerSession } from 'next-auth'

const RUN = `etapy-gating-${Date.now()}`

let orgId: string
let adminId: string
let zakazkaId: string

function loginAsAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
}

function postEtapa(zakId: string, body: Record<string, unknown> = {}) {
  return etapyPost(new Request('http://test', { method: 'POST', body: JSON.stringify(body) }), { params: { id: zakId } })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Etapy Gating', slug: RUN } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Vedoucí Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })
  adminId = admin.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const zakazka = await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-ZAK-001`, nazev: 'Vícetapová zakázka', klientId: klient.id, vedouciId: adminId,
      stav: 'V_REALIZACI',
      polozky: { create: [{ nazev: 'Jednotka', mnozstvi: 1, jednotka: 'ks', prodejniCena: 50000, dphSazba: 12, poradi: 0 }] },
    },
  })
  zakazkaId = zakazka.id
  loginAsAdmin()
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.vyuctovaniPolozka.deleteMany({ where: { vyuctovani: { orgId } } })
  await prisma.vyuctovani.deleteMany({ where: { orgId } })
  await prisma.predavakPolozka.deleteMany({ where: { predavak: { orgId } } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.skladPohyb.deleteMany({ where: { orgId } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('lineární etapy — přidání další etapy je zablokované, dokud předchozí není vyúčtovaná', () => {
  it('první etapu lze založit vždy', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 1' })
    expect(res.status).toBe(201)
  })

  it('druhou etapu nejde přidat, dokud první nemá schválený protokol ani vyúčtování', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toMatch(/dokončit/i)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(1)
  })

  it('ani se schváleným protokolem (bez schváleného vyúčtování) druhá etapa nejde', async () => {
    const etapa1 = await prisma.zakazkaEtapa.findFirstOrThrow({ where: { zakazkaId, cislo: 1 } })
    const p = await predavakyPost(new Request('http://test/api/predavaky', {
      method: 'POST', body: JSON.stringify({ zakazkaId, etapaId: etapa1.id }),
    }))
    const predavak = await p.json()
    await prisma.predavak.update({ where: { id: predavak.id }, data: { stav: 'PODPISAN', podpisano: new Date() } })
    const schval = await schvalitPost(new Request('http://test'), { params: { id: predavak.id } })
    expect(schval.status).toBe(200)
    const { vyuctovaniId } = await schval.json()

    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(422)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(1)

    // schválíme i vyúčtování pro navazující test
    const vyuSchval = await vyuSchvalitPost(new Request('http://test'), { params: { id: vyuctovaniId } })
    expect(vyuSchval.status).toBe(200)
  })

  it('jakmile je vyúčtování etapy 1 schválené, druhou etapu lze přidat', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 2' })
    expect(res.status).toBe(201)
    const etapa2 = await res.json()
    expect(etapa2.cislo).toBe(2)
  })

  it('třetí etapu zase nejde přidat, dokud druhá není vyúčtovaná', async () => {
    const res = await postEtapa(zakazkaId, { nazev: 'Etapa 3' })
    expect(res.status).toBe(422)
    expect(await prisma.zakazkaEtapa.count({ where: { zakazkaId } })).toBe(2)
  })
})
