import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST } from '@/app/api/zakazky/[id]/abra/route'
import { getServerSession } from 'next-auth'

/** F2 tlačítko „Založit v ABRA“ — oprávnění, org napojená na Flexi, dry-run vs. ostrý zápis */

const RUN = `abra-route-${Date.now()}`
const ENV = ['ABRA_FLEXI_URL', 'ABRA_FLEXI_COMPANY', 'ABRA_FLEXI_USER', 'ABRA_FLEXI_PASSWORD', 'ABRA_FLEXI_ORG_SLUG'] as const
const puvodniEnv: Record<string, string | undefined> = {}

let orgId: string
let userId: string
let zakazkaId: string
let zakazkaEtapaId: string
let zakazkaBezAdresyId: string

const ok = (winstrom: object) => new Response(JSON.stringify({ winstrom }), { status: 200 })
const nenalezeno = () => new Response('{}', { status: 404 })
const req = (body: object) => new Request('http://localhost/x', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const prihlas = (role: string, orgSlug = RUN) =>
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, orgSlug, role } } as never)

beforeAll(async () => {
  for (const k of ENV) puvodniEnv[k] = process.env[k]
  Object.assign(process.env, {
    ABRA_FLEXI_URL: 'https://flexi.test', ABRA_FLEXI_COMPANY: 'firma', ABRA_FLEXI_USER: 'api',
    ABRA_FLEXI_PASSWORD: 'tajne', ABRA_FLEXI_ORG_SLUG: RUN,
  })
  const org = await prisma.organization.create({ data: { nazev: 'Test ABRA route', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  userId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák', ulice: 'Hlavní 1', mesto: 'Ostrava', psc: '70200' } })
  const bezAdresy = await prisma.client.create({ data: { orgId, jmeno: 'Petr', prijmeni: 'Bezadresný', mesto: 'Ostrava' } })
  zakazkaBezAdresyId = (await prisma.zakazka.create({ data: { orgId, cislo: '26-902', klientId: bezAdresy.id, nazev: 'z', technologie: 'KLIMA' } })).id
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: '26-901', klientId: klient.id, nazev: 'x', technologie: 'KLIMA' } })).id
  zakazkaEtapaId = (await prisma.zakazka.create({ data: { orgId, cislo: 'S-26-001', klientId: klient.id, nazev: 'y' } })).id
})

afterEach(() => vi.unstubAllGlobals())

afterAll(async () => {
  for (const k of ENV) { if (puvodniEnv[k] === undefined) delete process.env[k]; else process.env[k] = puvodniEnv[k] }
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('POST /api/zakazky/[id]/abra', () => {
  it('bez nastavení organizace (manažer) 403, bez volání Flexi', async () => {
    prihlas('MANAZER')
    const f = vi.fn(); vi.stubGlobal('fetch', f)
    expect((await POST(req({ dryRun: true }), { params: { id: zakazkaId } })).status).toBe(403)
    expect(f).not.toHaveBeenCalled()
  })

  it('org nenapojená na Flexi 404', async () => {
    prihlas('ADMIN', 'jina-org')
    expect((await POST(req({ dryRun: true }), { params: { id: zakazkaId } })).status).toBe(404)
  })

  it('číslo mimo RR-NNN 422', async () => {
    prihlas('ADMIN')
    expect((await POST(req({ dryRun: true }), { params: { id: zakazkaEtapaId } })).status).toBe(422)
  })

  it('klient bez úplné adresy 422 se seznamem chybějících údajů', async () => {
    prihlas('ADMIN')
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => ok({ zakazka: [], adresar: [] })))
    const res = await POST(req({ dryRun: true }), { params: { id: zakazkaBezAdresyId } })
    expect(res.status).toBe(422)
    expect((await res.json()).chybi).toEqual(['ulice', 'PSČ'])
  })

  it('dry-run vrátí náhled a nic neuloží', async () => {
    prihlas('ADMIN')
    const f = vi.fn()
      .mockResolvedValueOnce(nenalezeno()) // zakázka podle ext kódu
      .mockResolvedValueOnce(ok({ zakazka: [] })) // zakázka podle kódu
      .mockResolvedValueOnce(nenalezeno()) // adresář podle ext ID
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '1' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '2' }] }))
    vi.stubGlobal('fetch', f)
    const res = await POST(req({ dryRun: true }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stav: 'NANECISTO', kod: '26-901', nazev: 'Novák Jan - Klimatizace', odberatel: 'Jan Novák', adresarNovy: true, existovala: false })
    expect(f.mock.calls.slice(3).every(c => String(c[0]).endsWith('?dry-run=true'))).toBe(true)
    const z = await prisma.zakazka.findUnique({ where: { id: zakazkaId } })
    expect(z?.abraOdeslano).toBeNull()
  })

  it('chybějící dryRun = nanečisto (bezpečný výchozí stav)', async () => {
    prihlas('ADMIN')
    const f = vi.fn().mockResolvedValueOnce(ok({ zakazka: [{ id: '42', firma: 'code:X' }] }))
    vi.stubGlobal('fetch', f)
    expect(await (await POST(req({}), { params: { id: zakazkaId } })).json()).toMatchObject({ dryRun: true, stav: 'EXISTUJE' })
    expect((await prisma.zakazka.findUnique({ where: { id: zakazkaId } }))?.abraOdeslano).toBeNull()
  })

  it('chyba Flexi → 502 s textem', async () => {
    prihlas('ADMIN')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ winstrom: { success: 'false', message: 'Neplatné přihlášení' } }), { status: 401 })))
    const res = await POST(req({ dryRun: false }), { params: { id: zakazkaId } })
    expect(res.status).toBe(502)
    expect((await res.json()).error).toContain('Neplatné přihlášení')
  })

  it('ostrý zápis uloží ID z Flexi a audit', async () => {
    prihlas('ADMIN')
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(nenalezeno())
      .mockResolvedValueOnce(ok({ zakazka: [] }))
      .mockResolvedValueOnce(ok({ adresar: [{ id: '500' }] }))
      .mockResolvedValueOnce(ok({ success: 'true', results: [{ id: '123' }] })))
    const res = await POST(req({ dryRun: false }), { params: { id: zakazkaId } })
    expect(await res.json()).toMatchObject({ stav: 'ZALOZENO', abraId: 123 })
    const z = await prisma.zakazka.findUnique({ where: { id: zakazkaId } })
    expect(z?.abraZakazkaId).toBe(123)
    expect(z?.abraOdeslano).toBeInstanceOf(Date)
    expect(await prisma.auditLog.count({ where: { orgId, zaznamId: zakazkaId } })).toBe(1)
  })
})
