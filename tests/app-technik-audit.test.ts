import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS, type Permissions } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { GET as denGet } from '@/app/api/mobile/vykaz/den/route'
import { GET as dnesGet } from '@/app/api/mobile/dnes/route'
import { GET as servisListGet } from '@/app/api/mobile/servis/zakazky/route'
import { POST as komentarPost } from '@/app/api/mobile/zakazka/[id]/komentar/route'
import { POST as vykazPost } from '@/app/api/mobile/vykaz/route'
import { POST as titulniPost } from '@/app/api/mobile/zakazka/[id]/titulni-foto/route'
import { GET as mesicGet } from '@/app/api/mobile/mesic/route'
import { getServerSession } from 'next-auth'
import { klientAppky } from '@/lib/mobile-helpers'
import { prijemciPoznamky } from '@/lib/poznamkaTechnika'
import { sweepVykazPripominky } from '@/lib/vykazPripominka'
import { sendPushToUsers } from '@/lib/push'
import { dnesPraha } from '@/lib/dnesniVyjezdy'

// Audit docs/ux-audit/APP_TECHNIK.md — backend pro Konec dne, Dnes se servisy, notifikace poznámek

const RUN = `apptech-${Date.now()}`
const DEN = dnesPraha()
const DEN_MIDNIGHT = new Date(`${DEN}T00:00:00.000Z`)
const VCERA = new Date(DEN_MIDNIGHT.getTime() - 86_400_000)
const ZITRA = new Date(DEN_MIDNIGHT.getTime() + 86_400_000)

let orgId: string
let technikId: string
let vedouciId: string
let adminId: string
let vicedenniId: string
let bezVedoucihoId: string
let servisDokoncenyId: string

const TECHNIK_PERMS: Permissions = { ...ROLE_PRESETS.TECHNIK, servis: 'VLASTNI' }

function login(id: string, perms: Permissions = TECHNIK_PERMS, role = 'TECHNIK') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId, role, plan: 'PROFESSIONAL', perms } } as never)
}

const req = (method: string, body?: unknown, url = 'http://test', headers?: Record<string, string>) =>
  new Request(url, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test App Technik', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  await prisma.orgSettings.create({ data: { orgId, modulServis: true } })
  technikId = (await prisma.user.create({ data: { orgId, jmeno: 'Tomáš Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' } })).id
  vedouciId = (await prisma.user.create({ data: { orgId, jmeno: 'Vedoucí Zakázky', email: `${RUN}-v@example.com`, hesloHash: 'x', role: 'OBCHODNIK' } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Radek Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Novák', telefon: '+420111', ulice: 'Sídelní 1', mesto: 'Ostrava', psc: '70200' } })

  // vícedenní montáž: včera–zítra → dnes musí být v Dnes i v Konci dne
  vicedenniId = (await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-26-001`, nazev: 'TČ vícedenní', klientId: klient.id, stav: 'V_REALIZACI',
      montazOd: VCERA, montazDo: ZITRA, vedouciId, techniciRel: { create: { technikId } },
    },
  })).id
  bezVedoucihoId = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-26-002`, nazev: 'Klima bez vedoucího', klientId: klient.id, stav: 'PRIRAZENA', montazOd: ZITRA, techniciRel: { create: { technikId } } },
  })).id

  const dnesPoledne = new Date(`${DEN}T10:00:00.000Z`)
  // dnes dokončený servis s adresou zásahu a kontaktem na místě
  servisDokoncenyId = (await prisma.servisniZakazka.create({
    data: {
      orgId, cislo: `${RUN}-S-1`, typ: 'PORUCHA', popis: 'Nechladí', klientId: klient.id, technikId, stav: 'DOKONCENA',
      planovanyTermin: dnesPoledne, priorita: 'URGENTNI', adresaZasahu: 'Hala 3, Frýdek', kontaktJmeno: 'Správce', kontaktTelefon: '+420999',
    } as never,
  })).id
  // servis bez adresy zásahu → fallback na adresu a telefon klienta
  await prisma.servisniZakazka.create({
    data: { orgId, cislo: `${RUN}-S-2`, typ: 'KONTROLA', klientId: klient.id, technikId, stav: 'NAPLANOVANA', planovanyTermin: dnesPoledne } as never,
  })
})

afterAll(async () => {
  await prisma.vykazPrace.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.zakazkaFoto.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazkaKomentar.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.servisniZakazka.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('GET /api/mobile/dnes — servisy + vícedenní montáž', () => {
  it('vícedenní montáž je v dnešku, zítřejší v nadcházejících, servisy jako nové pole', async () => {
    login(technikId)
    const r = await dnesGet(req('GET'))
    expect(r.status).toBe(200)
    const d = await r.json()
    expect(d.date).toBe(DEN)
    expect(d.zakazky.map((z: { id: string }) => z.id)).toEqual([vicedenniId])
    expect(d.upcoming.map((z: { id: string }) => z.id)).toEqual([bezVedoucihoId])
    // stávající pole zůstávají (starší verze appky)
    expect(d).toHaveProperty('bezTerminu')

    expect(d.servisy).toHaveLength(2)
    const urgentni = d.servisy.find((s: { id: string }) => s.id === servisDokoncenyId)
    expect(urgentni).toMatchObject({
      stav: 'DOKONCENA', priorita: 'URGENTNI', adresaZasahu: 'Hala 3, Frýdek', kontaktJmeno: 'Správce', kontaktTelefon: '+420999',
    })
    const kontrola = d.servisy.find((s: { id: string }) => s.id !== servisDokoncenyId)
    expect(kontrola.adresaZasahu).toContain('Sídelní 1')
    expect(kontrola.kontaktTelefon).toBe('+420111')
  })

  it('seznam servisů vrací adresu zásahu a kontakt', async () => {
    login(technikId)
    const list = await (await servisListGet(req('GET', undefined, 'http://test?vse=1'))).json()
    const s = list.find((x: { id: string }) => x.id === servisDokoncenyId)
    expect(s).toMatchObject({ adresaZasahu: 'Hala 3, Frýdek', kontaktTelefon: '+420999', priorita: 'URGENTNI' })
  })
})

describe('GET /api/mobile/vykaz/den — Konec dne', () => {
  it('dnešní výjezdy včetně dokončeného servisu, záznamy u nich, ne předvyplněné', async () => {
    login(technikId)
    const d = await (await denGet(req('GET'))).json()
    expect(d).toMatchObject({ datum: DEN, dnes: DEN, pouzivat: true })
    const ids = d.vyjezdy.map((v: { id: string }) => v.id)
    expect(ids).toContain(vicedenniId)
    expect(ids).toContain(servisDokoncenyId)
    expect(ids).not.toContain(bezVedoucihoId)
    expect(d.vyjezdy.every((v: { zaznamy: unknown[] }) => v.zaznamy.length === 0)).toBe(true)

    expect((await vykazPost(req('POST', { zakazkaId: vicedenniId, datum: DEN, hodiny: 6, km: 42 }))).status).toBe(201)
    const d2 = await (await denGet(req('GET'))).json()
    const v = d2.vyjezdy.find((x: { id: string }) => x.id === vicedenniId)
    expect(v.zaznamy).toHaveLength(1)
    expect(v.zaznamy[0]).toMatchObject({ hodiny: 6, km: 42 })
  })

  it('zápis k zakázce mimo plán dne se na Konci dne ukáže taky', async () => {
    login(technikId)
    expect((await vykazPost(req('POST', { zakazkaId: bezVedoucihoId, datum: DEN, hodiny: 1, km: 0 }))).status).toBe(201)
    const d = await (await denGet(req('GET'))).json()
    expect(d.vyjezdy.find((x: { id: string }) => x.id === bezVedoucihoId)?.zaznamy).toHaveLength(1)
  })

  it('jen dnes a 6 dní zpět', async () => {
    login(technikId)
    expect((await denGet(req('GET', undefined, `http://test?datum=${VCERA.toISOString().slice(0, 10)}`))).status).toBe(200)
    expect((await denGet(req('GET', undefined, `http://test?datum=${ZITRA.toISOString().slice(0, 10)}`))).status).toBe(400)
    expect((await denGet(req('GET', undefined, 'http://test?datum=2020-01-01'))).status).toBe(400)
  })
})

describe('poznámka technika → notifikace (vedoucí, jinak vedení)', () => {
  it('příjemci', async () => {
    expect(await prijemciPoznamky(orgId, vicedenniId, technikId)).toEqual([vedouciId])
    expect(await prijemciPoznamky(orgId, vicedenniId, vedouciId)).toEqual([]) // vedoucí sám sobě ne
    expect(await prijemciPoznamky(orgId, bezVedoucihoId, technikId)).toEqual([adminId])
  })

  it('POST komentáře z appky založí bell notifikaci vedoucímu', async () => {
    login(technikId)
    const r = await komentarPost(req('POST', { text: 'Chybí materiál: konzole' }), { params: { id: vicedenniId } })
    expect(r.status).toBe(201)
    const n = await prisma.notification.findMany({ where: { orgId, typ: 'POZNAMKA_TECHNIKA' } })
    expect(n.map(x => x.userId)).toEqual([vedouciId])
    expect(n[0].zprava).toContain('Tomáš Technik')
    expect(n[0].zprava).toContain('Chybí materiál')
    expect(n[0].url).toBe(`/zakazky/${vicedenniId}?tab=historie`)
  })
})

describe('platforma a verze appky', () => {
  it('z hlaviček, fallback z user-agentu', () => {
    expect(klientAppky(req('POST', undefined, 'http://test', { 'X-App-Name': 'felucia-tech', 'X-App-Platform': 'ios', 'X-App-Version': '1.1.0' })))
      .toEqual({ app: 'felucia-tech', platform: 'ios', verze: '1.1.0' })
    expect(klientAppky(req('POST', undefined, 'http://test', { 'User-Agent': 'okhttp/4.12.0' })))
      .toEqual({ app: null, platform: 'android', verze: null })
  })
})

describe('večerní připomínka bez sazby (Konec dne pro všechny)', () => {
  it('technik bez sazby dostane připomínku za dnešní nezapsaný servis', async () => {
    await prisma.vykazPrace.deleteMany({ where: { orgId } })
    await prisma.user.update({ where: { id: technikId }, data: { pushToken: 'ExponentPushToken[apptech]', sazbaHodina: null, sazbaKm: null } })
    vi.mocked(sendPushToUsers).mockClear()
    await sweepVykazPripominky()
    const naMe = vi.mocked(sendPushToUsers).mock.calls.filter(c => c[1].includes(technikId))
    expect(naMe).toHaveLength(1)
    expect(naMe[0][2].body).toContain('Konci dne')
  })
})

describe('titulní fotka z existující fotky + můj měsíc', () => {
  it('nastavit jako titulní jen fotku téže zakázky', async () => {
    login(technikId)
    const f = await prisma.zakazkaFoto.create({ data: { zakazkaId: vicedenniId, url: `/uploads/zakazky/${vicedenniId}/a.jpg`, nahralId: technikId } as never })
    const json = { 'Content-Type': 'application/json' }
    const r = await titulniPost(req('POST', { fotoId: f.id }, 'http://test', json), { params: { id: vicedenniId } })
    expect(r.status).toBe(200)
    expect((await prisma.zakazka.findUnique({ where: { id: vicedenniId } }))?.titulniFotoUrl).toBe(f.url)
    const cizi = await titulniPost(req('POST', { fotoId: f.id }, 'http://test', json), { params: { id: bezVedoucihoId } })
    expect(cizi.status).toBe(404)
  })

  it('můj měsíc počítá jen moje fotky a poznámky', async () => {
    login(technikId)
    const m = await (await mesicGet(req('GET'))).json()
    expect(m.mesic).toBe(DEN.slice(0, 7))
    expect(m.fotek).toBe(1)
    expect(m.poznamek).toBe(1)
    login(adminId, ROLE_PRESETS.ADMIN, 'ADMIN')
    expect((await (await mesicGet(req('GET'))).json()).fotek).toBe(0)
  })
})
