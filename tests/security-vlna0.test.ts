import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { PATCH as companyPatch } from '@/app/api/settings/company/route'
import { POST as fotoPost } from '@/app/api/zakazky/[id]/foto/route'
import { POST as titulniPost } from '@/app/api/zakazky/[id]/titulni-foto/route'
import { POST as podkladyPost } from '@/app/api/zakazky/[id]/podklady/route'
import { POST as invitePost } from '@/app/api/onboarding/invite/route'
import { POST as onboardingCompanyPost } from '@/app/api/onboarding/company/route'
import { POST as brandingPost } from '@/app/api/onboarding/branding/route'
import { DELETE as mobileFotoDelete } from '@/app/api/mobile/zakazka/[id]/foto/[fotoId]/route'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'
import { getServerSession } from 'next-auth'

/**
 * Regresní testy k bezpečnostnímu auditu 2026-09 (docs/SECURITY_AUDIT_2026-09.md),
 * vlna 0: path traversal přes cesty z DB (SEC-01/02), aktivní obsah v /uploads
 * (SEC-03), onboarding bez oprávnění (SEC-07).
 */

const RUN = `sec0-${Date.now()}`

let orgId: string
let adminId: string
let technikId: string
let zakazkaId: string

function loginAs(id: string, role: 'ADMIN' | 'TECHNIK') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId, role } } as never)
}

function json(body: unknown) {
  return new Request('http://test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
}

function multipart(field: string, name: string, content: Buffer, type: string) {
  const fd = new FormData()
  fd.append(field, new File([new Uint8Array(content)], name, { type }))
  return new Request('http://test', { method: 'POST', body: fd })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Sec Vlna 0', slug: RUN, plan: 'STANDARD', logo: '/uploads/org/x/logo.png' } })
  orgId = org.id
  const admin = await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' } })
  adminId = admin.id
  const technik = await prisma.user.create({ data: { orgId, jmeno: 'Technik', email: `${RUN}-technik@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  technikId = technik.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  const zakazka = await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-ZAK-1`, nazev: 'Zakázka', klientId: klient.id, vedouciId: adminId, stav: 'V_REALIZACI' },
  })
  zakazkaId = zakazka.id
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.magicLinkToken.deleteMany({ where: { user: { orgId } } })
  await prisma.zakázkaDokument.deleteMany({ where: { orgId } })
  await prisma.zakazkaFoto.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('SEC-01 — cesta loga se nedá nastavit z těla requestu ani použít k traversalu', () => {
  it('PATCH /api/settings/company ignoruje logo/logoBw z body', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await companyPatch(json({ nazev: 'Sec Vlna 0', logo: '../.env', logoBw: '/../../etc/passwd' }))
    expect(res.status).toBe(200)
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    expect(org?.logo).toBe('/uploads/org/x/logo.png')
    expect(org?.logoBw).toBeNull()
  })

  it('orgLogoDataUrl nepřečte nic mimo public/uploads', () => {
    expect(orgLogoDataUrl('../.env')).toBeNull()
    expect(orgLogoDataUrl('/uploads/../.env')).toBeNull()
    expect(orgLogoDataUrl('/../package.json')).toBeNull()
    expect(orgLogoDataUrl('/uploads/org/neexistuje/logo.png')).toBeNull()
  })
})

describe('SEC-02 — url fotky z JSON musí být obrázek jako data: URI', () => {
  it('POST /api/zakazky/[id]/foto odmítne cestu na disk', async () => {
    loginAs(adminId, 'ADMIN')
    for (const url of ['/../.env', '/uploads/zakazky/x/../../../.env', 'https://evil/x.jpg', 'data:text/html;base64,AAAA']) {
      const res = await fotoPost(json({ url }), { params: { id: zakazkaId } })
      expect(res.status, url).toBe(400)
    }
    const ok = await fotoPost(json({ url: 'data:image/png;base64,iVBORw0KGgo=' }), { params: { id: zakazkaId } })
    expect(ok.status).toBe(201)
  })

  it('POST /api/zakazky/[id]/titulni-foto odmítne cestu na disk', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await titulniPost(json({ url: '/../.env' }), { params: { id: zakazkaId } })
    expect(res.status).toBe(400)
  })

  it('DELETE fotky s traversal cestou v DB nesmaže nic mimo adresář zakázky a záznam odstraní', async () => {
    loginAs(adminId, 'ADMIN')
    // Záznam s podvrženou cestou (simulace dat z doby před opravou)
    const foto = await prisma.zakazkaFoto.create({ data: { zakazkaId, url: '/uploads/zakazky/' + zakazkaId + '/../../../../package.json', nahralId: adminId } })
    const req = new Request('http://test', { method: 'DELETE', headers: { authorization: 'Bearer x' } })
    const res = await mobileFotoDelete(req, { params: { id: zakazkaId, fotoId: foto.id } })
    expect(res.status).toBe(200)
    // package.json je tady stále (unlink neproběhl mimo uploads)
    const fs = await import('fs')
    expect(fs.existsSync('package.json')).toBe(true)
    expect(await prisma.zakazkaFoto.findUnique({ where: { id: foto.id } })).toBeNull()
  })
})

describe('SEC-03 — do /uploads nejde nahrát aktivní obsah', () => {
  const html = Buffer.from('<!DOCTYPE html><html><script>alert(1)</script></html>')
  const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)])

  it('podklad .html / .svg / HTML převlečený za .pdf → 415', async () => {
    loginAs(adminId, 'ADMIN')
    for (const [name, type] of [['x.html', 'text/html'], ['x.svg', 'image/svg+xml'], ['x.pdf', 'application/pdf'], ['x.png', 'image/png']] as const) {
      const res = await podkladyPost(multipart('soubor', name, html, type), { params: { id: zakazkaId } })
      expect(res.status, name).toBe(415)
    }
  })

  it('legacy JSON podklad s HTML v data: URI → 415', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await podkladyPost(json({ nazev: 'x.html', url: 'data:text/html;base64,' + html.toString('base64') }), { params: { id: zakazkaId } })
    expect(res.status).toBe(415)
  })

  it('onboarding branding: HTML pojmenované logo.png → 415 (přípona jen z obsahu)', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await brandingPost(multipart('logo', 'logo.png', html, 'image/png'))
    expect(res.status).toBe(415)
  })

  it('skutečný obrázek s podvrženou příponou se uloží pod správnou příponou', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await brandingPost(multipart('logo', 'logo.html', png, 'text/html'))
    expect(res.status).toBe(200)
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    expect(org?.logo).toMatch(/^\/uploads\/logos\/logo-.*\.png$/)
    const fs = await import('fs')
    const abs = 'public' + org!.logo!
    expect(fs.existsSync(abs)).toBe(true)
    fs.unlinkSync(abs)
  })
})

describe('SEC-07 — onboarding routes vyžadují oprávnění', () => {
  it('TECHNIK nemůže zvát uživatele (a dostat magic link) ani měnit firmu', async () => {
    loginAs(technikId, 'TECHNIK')
    const inv = await invitePost(json({ emails: [`${RUN}-novy@example.com`] }))
    expect(inv.status).toBe(403)
    expect(await prisma.user.count({ where: { orgId, email: `${RUN}-novy@example.com` } })).toBe(0)

    const comp = await onboardingCompanyPost(json({ nazev: 'Hacknuto' }))
    expect(comp.status).toBe(403)
    const org = await prisma.organization.findUnique({ where: { id: orgId } })
    expect(org?.nazev).toBe('Sec Vlna 0')
  })

  it('ADMIN pozvánku založí a zapíše do audit logu', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await invitePost(json({ emails: [`${RUN}-obchodnik@example.com`] }))
    expect(res.status).toBe(200)
    const novy = await prisma.user.findFirst({ where: { orgId, email: `${RUN}-obchodnik@example.com` } })
    expect(novy?.role).toBe('OBCHODNIK')
    const log = await prisma.auditLog.findFirst({ where: { orgId, typZaznamu: 'User', zaznamId: novy!.id } })
    expect(log?.userId).toBe(adminId)
  })
})
