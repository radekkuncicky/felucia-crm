import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { POST as etapyPost } from '@/app/api/zakazky/[id]/etapy/route'
import { DELETE as etapaDelete } from '@/app/api/zakazky/[id]/etapy/[etapaId]/route'
import { getServerSession } from 'next-auth'

const RUN = `etapa-del-${Date.now()}`

let orgId: string
let adminId: string
let technikId: string
let ciziTechnik: string
let zakazkaId: string

function loginAs(userId: string, role: string) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role } } as never)
}
const json = (method: string, body?: unknown) =>
  new Request('http://test', { method, body: body === undefined ? undefined : JSON.stringify(body) })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test etapa smazání', slug: RUN } })
  orgId = org.id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })).id
  technikId = (await prisma.user.create({
    data: { orgId, jmeno: 'Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })).id
  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })
  ciziTechnik = (await prisma.user.create({
    data: { orgId: cizi.id, jmeno: 'Cizí', email: `${RUN}-c@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'K', prijmeni: 'K' } })
  // Etapa 1 kompletně hotová → zakázka vyúčtovaná
  zakazkaId = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-ZAK`, nazev: 'Etapy', klientId: klient.id, vedouciId: adminId, stav: 'VYUCTOVANA' },
  })).id
  const e1 = await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId, cislo: 1, stav: 'PREDANA' } })
  await prisma.predavak.create({
    data: { orgId, zakazkaId, etapaId: e1.id, cislo: `${RUN}-PP`, technikId, stav: 'SCHVALEN' },
  })
  await prisma.vyuctovani.create({
    data: { orgId, zakazkaId, etapaId: e1.id, cislo: `${RUN}-VYU`, stav: 'SCHVALENO' },
  })
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { slug: { startsWith: RUN } } }).catch(() => {})
})

describe('smazání etapy a její vrácení', () => {
  it('smazání etapy 2 vrátí zakázku do VYUCTOVANA a „Vrátit" ji obnoví se stejnými daty', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await etapyPost(json('POST', { nazev: 'Dokončení', montazOd: '2026-11-02', poznamka: 'pozn' }), { params: { id: zakazkaId } })
    expect(res.status).toBe(201)
    const e2 = await res.json()
    await prisma.etapaTechnik.create({ data: { orgId, etapaId: e2.id, technikId } })
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaId } }))?.stav).toBe('V_REALIZACI')

    const del = await etapaDelete(json('DELETE'), { params: { id: zakazkaId, etapaId: e2.id } })
    expect(del.status).toBe(200)
    const { obnova, zakazkaNovyStav } = await del.json()
    expect(zakazkaNovyStav).toBe('VYUCTOVANA')
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaId } }))?.stav).toBe('VYUCTOVANA')
    expect(await prisma.auditLog.count({ where: { orgId, typZaznamu: 'ZakazkaEtapa', zaznamId: e2.id } })).toBe(1)

    // cizí technik v obnově se ignoruje
    const back = await etapyPost(json('POST', { ...obnova, technikIds: [...obnova.technikIds, ciziTechnik] }), { params: { id: zakazkaId } })
    expect(back.status).toBe(201)
    const e2b = await back.json()
    expect(e2b.cislo).toBe(2)
    expect(e2b.nazev).toBe('Dokončení')
    expect(e2b.poznamka).toBe('pozn')
    expect(e2b.montazOd.slice(0, 10)).toBe('2026-11-02')
    const technici = await prisma.etapaTechnik.findMany({ where: { etapaId: e2b.id } })
    expect(technici.map(t => t.technikId)).toEqual([technikId])
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaId } }))?.stav).toBe('V_REALIZACI')
  })

  it('bez práva mazání zakázek etapu smazat nejde', async () => {
    const e = await prisma.zakazkaEtapa.findFirst({ where: { zakazkaId, cislo: 2 } })
    loginAs(technikId, 'TECHNIK')
    const del = await etapaDelete(json('DELETE'), { params: { id: zakazkaId, etapaId: e!.id } })
    expect(del.status).toBe(403)
  })
})
