import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/pdf', () => ({ generatePdf: vi.fn(async (html: string) => Buffer.from(html)) }))
vi.mock('@/lib/email', async (orig) => ({
  ...(await orig<typeof import('@/lib/email')>()),
  isOrgEmailConfigured: vi.fn(async () => true),
  sendOrgEmail: vi.fn(async () => {}),
}))

import { getServerSession } from 'next-auth'
import { sendOrgEmail } from '@/lib/email'
import { generateServisniProtokolHtml } from '@/lib/servisniProtokolHtml'
import { GET as protokolGet } from '@/app/api/servis/zakazky/[id]/protokol/route'
import { POST as odeslatPost } from '@/app/api/servis/zakazky/[id]/protokol/odeslat/route'

const RUN = `protokol-${Date.now()}`
let orgId: string
let ciziOrgId: string
let adminId: string
let obchodnikId: string
let ciziAdminId: string
let zakazkaId: string
let zakazkaBezEmailuId: string
let zakazkaZeSmlouvyId: string

function loginAs(userId: string, org: string, role = 'ADMIN') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role, plan: 'PROFESSIONAL' } } as never)
}
const post = (body: unknown) => new Request('http://x/odeslat', { method: 'POST', body: JSON.stringify(body) })
const P = (id: string) => ({ params: { id } })

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Protokol', slug: RUN, plan: 'PROFESSIONAL', email: 'servis@firma.cz' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi`, plan: 'PROFESSIONAL' } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  obchodnikId = (await prisma.user.create({ data: { orgId, jmeno: 'Obchodník', email: `${RUN}-o@example.com`, hesloHash: 'x', role: 'OBCHODNIK' } })).id
  ciziAdminId = (await prisma.user.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', email: `${RUN}-c@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id

  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák', email: 'jan@novak.cz' } })
  const bezEmailu = await prisma.client.create({ data: { orgId, jmeno: 'Bez', prijmeni: 'Emailu' } })
  const smluvni = await prisma.client.create({ data: { orgId, jmeno: 'Smluvní', prijmeni: 'Klient', email: 'smlouva@klient.cz' } })
  const kontrakt = await prisma.servisniKontrakt.create({
    data: { orgId, klientId: smluvni.id, nazev: 'Roční servis', typ: 'ROCNI', intervalMesicu: 12, zacatek: new Date(), aktivni: true },
  })

  zakazkaId = (await prisma.servisniZakazka.create({
    data: {
      orgId, klientId: klient.id, cislo: `${RUN}-1`, zprava: 'Vyčištěno',
      polozky: { create: [{ orgId, popis: 'Chladivo R32', typ: 'MATERIAL', mnozstvi: 1.5, jednotka: 'kg', cenaZaJednotku: 999 }] },
    },
  })).id
  zakazkaBezEmailuId = (await prisma.servisniZakazka.create({ data: { orgId, klientId: bezEmailu.id, cislo: `${RUN}-2` } })).id
  zakazkaZeSmlouvyId = (await prisma.servisniZakazka.create({ data: { orgId, kontraktId: kontrakt.id, cislo: `${RUN}-3` } })).id
})

afterAll(async () => {
  for (const id of [orgId, ciziOrgId]) {
    await prisma.auditLog.deleteMany({ where: { orgId: id } })
    await prisma.webhookOutbox.deleteMany({ where: { orgId: id } })
    await prisma.servisniPolozka.deleteMany({ where: { orgId: id } })
    await prisma.servisniZakazka.deleteMany({ where: { orgId: id } })
    await prisma.servisniKontrakt.deleteMany({ where: { orgId: id } })
    await prisma.client.deleteMany({ where: { orgId: id } })
    await prisma.user.deleteMany({ where: { orgId: id } })
    await prisma.orgSettings.deleteMany({ where: { orgId: id } })
    await prisma.organization.delete({ where: { id } })
  }
  await prisma.$disconnect()
})

describe('generateServisniProtokolHtml', () => {
  const base = {
    id: 'abc', cislo: 'SZ-1', typ: 'PORUCHA', planovanyTermin: null, skutecnyTermin: null, trvaniMinut: 90,
    zprava: '<script>alert(1)</script>', nalezeneZavady: null, doporuceni: null, podpisKlienta: null,
    fotky: Array.from({ length: 9 }, (_, i) => `data:image/png;base64,${i}`).concat(['/uploads/x.jpg', 'javascript:alert(1)']),
    technik: { jmeno: 'Technik' },
    polozky: [{ typ: 'MATERIAL', popis: 'Filtr', mnozstvi: 2, jednotka: 'ks', krytoKontraktem: true }],
  }
  const org = { nazev: 'Firma', sidlo: null, ico: '123', email: null, telefon: null, logo: null }
  const klient = { jmeno: 'Jan', prijmeni: 'Novák', telefon: null, email: null, ulice: null, mesto: null, psc: null }

  it('escapuje text, neukazuje ceny, bere max 6 fotek jen z data: URL', () => {
    const html = generateServisniProtokolHtml(base, null, klient, org)
    expect(html).not.toContain('<script>alert')
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toMatch(/Kč/)
    expect(html.match(/<img src="data:image\/png/g)?.length).toBe(6)
    expect(html).not.toContain('/uploads/x.jpg')
    expect(html).not.toContain('javascript:')
    expect(html).toContain('v ceně smlouvy')
    // prázdné sekce se nevykreslí
    expect(html).not.toContain('Zjištěné závady')
    expect(html).not.toContain('Doporučení')
  })

  it('stav dokumentu: koncept / nepodepsáno / podepsáno', () => {
    expect(generateServisniProtokolHtml(base, null, klient, org)).toContain('Koncept')
    const dokonceno = { ...base, protokolDokoncen: new Date() }
    expect(generateServisniProtokolHtml(dokonceno, null, klient, org)).toContain('Nepodepsáno klientem')
    const podepsano = { ...dokonceno, podpisKlienta: 'data:image/png;base64,AAAA' }
    const html = generateServisniProtokolHtml(podepsano, null, klient, org)
    expect(html).toContain('Podepsáno klientem')
    expect(html).toContain('Podepsáno elektronicky')
  })

  it('klient nebyl přítomen: bez podpisu, s poznámkou (i když podpis v DB zůstal)', () => {
    const nepritomen = { ...base, protokolDokoncen: new Date(), klientPritomen: false, podpisKlienta: 'data:image/png;base64,AAAA' }
    const html = generateServisniProtokolHtml(nepritomen, null, klient, org)
    expect(html).toContain('Klient nebyl přítomen')
    expect(html).toContain('Klient nebyl při zásahu přítomen')
    expect(html).not.toContain('Nepodepsáno klientem')
    expect(html).not.toContain('Podepsáno elektronicky')
    expect(html).not.toContain('alt="Podpis zákazníka"')
  })
})

describe('protokol API', () => {
  it('PDF jde stáhnout i bez podpisu, s položkami bez cen', async () => {
    loginAs(adminId, orgId)
    const res = await protokolGet(new Request('http://x/protokol?inline=1'), P(zakazkaId))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Disposition')).toMatch(/^inline; filename="Servisni-protokol-.*-Novak\.pdf"/)
    const html = await res.text()
    expect(html).toContain('Chladivo R32')
    expect(html).not.toContain('999')
  })

  it('obchodník bez servisu dostane 403, cizí org 404', async () => {
    loginAs(obchodnikId, orgId, 'OBCHODNIK')
    expect((await protokolGet(new Request('http://x/protokol'), P(zakazkaId))).status).toBe(403)
    expect((await odeslatPost(post({}), P(zakazkaId))).status).toBe(403)
    loginAs(ciziAdminId, ciziOrgId)
    expect((await protokolGet(new Request('http://x/protokol'), P(zakazkaId))).status).toBe(404)
    expect((await odeslatPost(post({}), P(zakazkaId))).status).toBe(404)
  })

  it('odeslání na e-mail klienta s PDF přílohou a evidencí', async () => {
    loginAs(adminId, orgId)
    vi.mocked(sendOrgEmail).mockClear()
    const res = await odeslatPost(post({ zprava: 'Díky' }), P(zakazkaId))
    expect(res.status).toBe(200)
    expect((await res.json()).to).toBe('jan@novak.cz')
    const [org, to, subject, , attachments] = vi.mocked(sendOrgEmail).mock.calls[0]
    expect(org).toBe(orgId)
    expect(to).toBe('jan@novak.cz')
    expect(subject).toContain(`${RUN}-1`)
    expect(attachments?.[0].filename).toMatch(/\.pdf$/)
    const z = await prisma.servisniZakazka.findUnique({ where: { id: zakazkaId } })
    expect(z?.protokolOdeslan).toBeInstanceOf(Date)
    expect(z?.protokolOdeslanNa).toBe('jan@novak.cz')
    expect(await prisma.auditLog.count({ where: { orgId, zaznamId: zakazkaId } })).toBe(1)
  })

  it('klient bez e-mailu → 400, s ručně zadanou adresou projde', async () => {
    loginAs(adminId, orgId)
    expect((await odeslatPost(post({}), P(zakazkaBezEmailuId))).status).toBe(400)
    expect((await odeslatPost(post({ to: 'nejde' }), P(zakazkaBezEmailuId))).status).toBe(400)
    const ok = await odeslatPost(post({ to: 'rucne@klient.cz' }), P(zakazkaBezEmailuId))
    expect(ok.status).toBe(200)
  })

  it('zakázka ze smlouvy bere klienta z kontraktu', async () => {
    loginAs(adminId, orgId)
    const res = await odeslatPost(post({}), P(zakazkaZeSmlouvyId))
    expect(res.status).toBe(200)
    expect((await res.json()).to).toBe('smlouva@klient.cz')
  })
})
