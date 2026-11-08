import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
const html: string[] = []
vi.mock('@/lib/pdf', () => ({ generatePdf: vi.fn(async (h: string) => { html.push(h); return Buffer.from('%PDF-1.4 test') }) }))
// nezapisovat do public/uploads (testy běží v prod adresáři)
vi.mock('@/lib/zakazkaPodklady', () => ({ ulozitPodklad: vi.fn(async (id: string, _b: Buffer, n: string) => `/uploads/zakazky/${id}/${n}`) }))

import { getServerSession } from 'next-auth'
import { POST } from '@/app/api/zakazky/[id]/tlakova-zkouska/route'
import { parseTlakovaZkouska } from '@/lib/tlakovaZkouskaData'

const RUN = `tlak-${Date.now()}`
let orgId: string
let ciziOrgId: string
let zakazkaId: string
let ciziZakazkaId: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Tlak', slug: RUN, plan: 'STANDARD' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-c`, plan: 'STANDARD' } })).id
  const user = await prisma.user.create({ data: { orgId, jmeno: 'Tomáš', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  const k = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: '<b>Novák</b>' } })
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-1`, klientId: k.id, nazev: 'Podlahovka', mistoStavby: 'Lesní 1' } })).id
  const kc = await prisma.client.create({ data: { orgId: ciziOrgId, jmeno: 'X', prijmeni: 'Y' } })
  ciziZakazkaId = (await prisma.zakazka.create({ data: { orgId: ciziOrgId, cislo: `${RUN}-2`, klientId: kc.id, nazev: 'x' } })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: user.id, orgId, role: 'ADMIN', plan: 'STANDARD', jmeno: 'Tomáš' } } as never)
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
  POST(new Request(`http://localhost/api/zakazky/${id}/tlakova-zkouska`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }), { params: { id } })

const vstup = {
  datum: '2026-11-08', zkousel: 'Tomáš', vysledek: 'VYHOVEL', poznamka: '',
  podlahovka: { trubkaTyp: 'PE-Xa', trubkaDimenze: '16×2', pocetOkruhu: '6', delkaM: '480', medium: 'VODA', zkusebniTlak: '6', dobaH: '24', tlakZacatek: '6,0', tlakKonec: '5,8', podTlakemPriBetonazi: true },
  tc: null,
}

describe('Protokol o tlakové zkoušce', () => {
  it('validace: datum, aspoň jedna zkouška, výsledek', () => {
    expect(parseTlakovaZkouska({ ...vstup, datum: '' })).toMatch(/datum/)
    expect(parseTlakovaZkouska({ ...vstup, podlahovka: null })).toMatch(/aspoň jednu/)
    expect(parseTlakovaZkouska({ ...vstup, vysledek: 'X' })).toMatch(/výsledek/)
    const ok = parseTlakovaZkouska(vstup)
    expect(typeof ok !== 'string' && ok.podlahovka?.tlakZacatek).toBe(6)
  })

  it('vytvoří PDF, uloží do Podkladů, escapuje data a spočítá pokles', async () => {
    const res = await post(zakazkaId, vstup)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('application/pdf')
    const dok = await prisma.zakázkaDokument.findFirst({ where: { zakazkaId } })
    expect(dok).toMatchObject({ mime: 'application/pdf', nazev: expect.stringContaining('Protokol o tlakové zkoušce') })
    const h = html.at(-1)!
    expect(h).toContain('&lt;b&gt;Novák&lt;/b&gt;')
    expect(h).toContain('Lesní 1')
    expect(h).toMatch(/Pokles tlaku<\/td><td class="v">0,2 bar/)
    expect(h).toContain('VYHOVĚL')
  })

  it('cizí zakázka = 403', async () => {
    const res = await post(ciziZakazkaId, vstup)
    expect(res.status).toBe(403)
  })
})
