import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
const html: string[] = []
vi.mock('@/lib/pdf', () => ({ generatePdf: vi.fn(async (h: string) => { html.push(h); return Buffer.from('%PDF-1.4 test') }) }))
// nezapisovat do public/uploads (testy běží v prod adresáři)
vi.mock('@/lib/zakazkaPodklady', () => ({ ulozitPodklad: vi.fn(async (id: string, _b: Buffer, n: string) => `/uploads/zakazky/${id}/${n}`) }))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/zakazky/[id]/zaregulovani-vzt/route'
import { parseZaregulovaniVzt, odchylka, teplotniUcinnost, nerovnovaha } from '@/lib/zaregulovaniVztData'

const RUN = `vzt-${Date.now()}`
let orgId: string
let ciziOrgId: string
let zakazkaId: string
let ciziZakazkaId: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'VZT', slug: RUN, plan: 'STANDARD' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-c`, plan: 'STANDARD' } })).id
  const user = await prisma.user.create({ data: { orgId, jmeno: 'Veči', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  const k = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: '<b>Novák</b>' } })
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-1`, klientId: k.id, nazev: 'Rekuperace RD', mistoStavby: 'Lesní 1' } })).id
  const kc = await prisma.client.create({ data: { orgId: ciziOrgId, jmeno: 'X', prijmeni: 'Y' } })
  ciziZakazkaId = (await prisma.zakazka.create({ data: { orgId: ciziOrgId, cislo: `${RUN}-2`, klientId: kc.id, nazev: 'x' } })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, orgId, role: 'ADMIN', plan: 'STANDARD', jmeno: 'Veči' } } as never)
})

afterAll(async () => {
  await prisma.zakázkaDokument.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId: { in: [orgId, ciziOrgId] } } })
  await prisma.client.deleteMany({ where: { orgId: { in: [orgId, ciziOrgId] } } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId: { in: [orgId, ciziOrgId] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, ciziOrgId] } } })
  await prisma.$disconnect()
})

const post = (id: string, body: unknown) =>
  POST(new Request(`http://localhost/api/zakazky/${id}/zaregulovani-vzt`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { id } })

const vstup = {
  datum: '2026-11-13', provedl: 'Veči', vysledek: 'VYHOVEL', poznamka: '', metoda: 'Balometr (měřicí nástavec)',
  jednotka: { typ: 'Atrea Duplex 370', vyrobniCislo: 'A1', umisteni: 'TM', rezim: 'stupeň 2' },
  pristroj: { typ: 'Testo 420', vyrobniCislo: 'T9', kalibrace: '2026-03-01' },
  celkem: { privodNavrh: '', privodNamereno: '', odvodNavrh: '', odvodNamereno: '' },
  teploty: { venkovni: '2', privod: '17', odvod: '22', odpadni: '' },
  tolerance: '15',
  kontroly: { filtry: true, zaskoleni: true, nesmysl: true },
  vyustky: [
    { mistnost: 'Obývák', typ: 'PRIVOD', prvek: 'ventil 125', navrh: '60', namereno: '58', nastaveni: '4 ot.' },
    { mistnost: 'Ložnice', typ: 'PRIVOD', prvek: '', navrh: '40', namereno: '50', nastaveni: '' },
    { mistnost: 'Koupelna', typ: 'ODVOD', prvek: '', navrh: '100', namereno: '104', nastaveni: '' },
    { mistnost: '', typ: 'ODVOD', prvek: '', navrh: '', namereno: '', nastaveni: '' },
  ],
}

describe('Protokol o zaregulování VZT', () => {
  it('výpočty: odchylka, účinnost, nerovnováha', () => {
    expect(odchylka(40, 50)).toBe(25)
    expect(odchylka(0, 50)).toBeNull()
    expect(teplotniUcinnost({ venkovni: 2, privod: 17, odvod: 22, odpadni: null })).toBe(75)
    expect(teplotniUcinnost({ venkovni: 20, privod: 21, odvod: 21, odpadni: null })).toBeNull()
    expect(nerovnovaha(108, 104)).toBe(3.8)
  })

  it('validace: datum, aspoň jedno měření, výsledek; prázdné řádky a cizí kontroly zahodí', () => {
    expect(parseZaregulovaniVzt({ ...vstup, datum: '' })).toMatch(/datum/)
    expect(parseZaregulovaniVzt({ ...vstup, vyustky: [] })).toMatch(/naměřený průtok/)
    expect(parseZaregulovaniVzt({ ...vstup, vysledek: 'X' })).toMatch(/výsledek/)
    const ok = parseZaregulovaniVzt(vstup)
    if (typeof ok === 'string') throw new Error(ok)
    expect(ok.vyustky).toHaveLength(3)
    expect(ok.kontroly.filtry).toBe(true)
    expect(ok.kontroly.hluk).toBe(false)
    expect('nesmysl' in ok.kontroly).toBe(false)
  })

  it('vytvoří PDF, uloží do Podkladů, escapuje, označí odchylky a dopočte součty', async () => {
    const res = await post(zakazkaId, vstup)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const dok = await prisma.zakázkaDokument.findFirst({ where: { zakazkaId } })
    expect(dok).toMatchObject({ mime: 'application/pdf', nazev: expect.stringContaining('Protokol o zaregulování VZT') })
    const h = html.at(-1)!
    expect(h).toContain('&lt;b&gt;Novák&lt;/b&gt;')
    expect(h).toContain('ČSN EN 12599')
    expect(h).toMatch(/ko-cell">\+25 %/) // ložnice mimo ±15 %
    expect(h).toMatch(/ok-cell">-3,3 %/) // obývák v toleranci
    expect(h).toContain('108 m³/h') // celkový přívod = součet vyústek
    expect(h).toContain('75 %') // účinnost
  })

  it('cizí zakázka = 403', async () => {
    const res = await post(ciziZakazkaId, vstup)
    expect(res.status).toBe(403)
  })
})
