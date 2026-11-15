import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/mobile-auth', () => ({ getMobileSession: vi.fn(async () => null) }))

import { getServerSession } from 'next-auth'
import { POST as pripadyPost } from '@/app/api/mobile/obchod/pripady/route'
import { GET as kalendarGet } from '@/app/api/mobile/obchod/kalendar/route'
import { GET as odkazGet, POST as odkazPost } from '@/app/api/mobile/obchod/kalendar/odkaz/route'
import { GET as icsGet } from '@/app/api/calendar/ics/route'
import { getCalendarToken } from '@/lib/calendarToken'
import { foldLine, mistniRozsah, vevent } from '@/lib/ics'

/** Felucia Sales Vlna 4: ICS s časem (TZID Praha), pohled Týden, odkaz na odběr. */

const RUN = `skal-${Date.now()}`
let orgId: string
let olgaId: string
let petrId: string
let dealId: string

const login = (id: string) =>
  vi.mocked(getServerSession).mockResolvedValue({ user: { id, orgId, role: 'OBCHODNIK', plan: 'PROFESSIONAL' } } as never)
const get = (url: string) => new Request(`http://localhost${url}`)

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Kalendář', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const mk = (jmeno: string) => prisma.user.create({ data: { orgId, jmeno, email: `${jmeno}-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' } })
  olgaId = (await mk('olga')).id
  petrId = (await mk('petr')).id
  login(olgaId)
  const res = await pripadyPost(new Request('http://localhost/x', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ klient: { jmeno: 'Karel', prijmeni: 'Kalendářní', telefon: '+420777300400' }, technologie: 'KLIMA' }),
  }))
  expect(res.status).toBe(201)
  dealId = (await res.json()).id
  await prisma.deal.update({ where: { id: dealId }, data: { terminRealizace: new Date('2026-11-18'), terminPrevzeti: new Date('2026-11-20') } })
  await prisma.activity.createMany({
    data: [
      // léto (SELČ) i zima (SEČ) — v ICS musí zůstat 14:30 místního času
      { orgId, dealId, userId: olgaId, typ: 'SCHUZKA', datum: new Date('2026-11-17'), cas: '14:30', trvaniMin: 90, misto: 'Dolní 5, Ostrava', stav: 'PLANOVANA' },
      { orgId, dealId, userId: olgaId, typ: 'HOVOR', datum: new Date('2026-11-19'), stav: 'PLANOVANA' },
      { orgId, dealId, userId: olgaId, typ: 'SCHUZKA', datum: new Date('2026-07-01'), cas: '09:00', trvaniMin: 60, stav: 'PLANOVANA' },
      // cizí aktivita — Olga ji nesmí vidět
      { orgId, dealId, userId: petrId, typ: 'HOVOR', datum: new Date('2026-11-17'), cas: '10:00', popis: 'PETRUV', stav: 'PLANOVANA' },
    ],
  })
})

afterAll(async () => {
  await prisma.activity.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
})

describe('lib/ics', () => {
  it('místní rozsah: 14:30 + 90 min, přes půlnoc posune den', () => {
    expect(mistniRozsah('2026-11-17', '14:30', 90)).toEqual({ start: '20261117T143000', end: '20261117T160000' })
    expect(mistniRozsah('2026-12-31', '23:30', 60)).toEqual({ start: '20261231T233000', end: '20270101T003000' })
    expect(mistniRozsah('2026-11-17', '25:00', 60)).toBeNull()
  })

  it('zalomení po 75 bajtech nerozdělí znak s diakritikou', () => {
    const line = `SUMMARY:${'ř'.repeat(100)}`
    const folded = foldLine(line)
    for (const l of folded.split('\r\n')) expect(new TextEncoder().encode(l).length).toBeLessThanOrEqual(75)
    expect(folded.replace(/\r\n /g, '')).toBe(line)
  })

  it('bez času zůstává celodenní, DTSTAMP je vždy', () => {
    const v = vevent({ uid: 'x', date: '2026-11-17', summary: 'a', description: '', url: 'u' }, '20261115T000000Z')
    expect(v).toContain('DTSTART;VALUE=DATE:20261117')
    expect(v).toContain('DTEND;VALUE=DATE:20261118')
    expect(v).toContain('DTSTAMP:20261115T000000Z')
  })
})

describe('ICS feed', () => {
  it('schůzka s časem jde jako TZID Europe/Prague 14:30–16:00, bez času celodenní, VTIMEZONE v kalendáři', async () => {
    const res = await icsGet(get(`/api/calendar/ics?uid=${olgaId}&sig=${getCalendarToken(olgaId, 0)}`))
    expect(res.status).toBe(200)
    const text = (await res.text()).replace(/\r\n /g, '')
    expect(text).toContain('BEGIN:VTIMEZONE')
    expect(text).toContain('DTSTART;TZID=Europe/Prague:20261117T143000')
    expect(text).toContain('DTEND;TZID=Europe/Prague:20261117T160000')
    expect(text).toContain('DTSTART;TZID=Europe/Prague:20260701T090000')
    expect(text).toContain('DTSTART;VALUE=DATE:20261119')
    expect(text).toContain('LOCATION:Dolní 5\\, Ostrava')
    expect(text).not.toContain('PETRUV')
  })
})

describe('GET /api/mobile/obchod/kalendar', () => {
  it('vrátí moje aktivity s časem a termíny OP v rozsahu, ne cizí', async () => {
    login(olgaId)
    const res = await kalendarGet(get('/api/mobile/obchod/kalendar?od=2026-11-16&do=2026-11-22'))
    expect(res.status).toBe(200)
    const { udalosti } = await res.json()
    const schuzka = udalosti.find((u: { typ: string; cas: string }) => u.typ === 'SCHUZKA')
    expect(schuzka).toMatchObject({ datum: '2026-11-17', cas: '14:30', trvaniMin: 90, misto: 'Dolní 5, Ostrava', dealId })
    expect(schuzka.nazev).toBe('Karel Kalendářní – Klimatizace – schůzka')
    expect(udalosti.some((u: { popis: string | null }) => u.popis === 'PETRUV')).toBe(false)
    expect(udalosti.find((u: { druh: string }) => u.druh === 'REALIZACE')).toMatchObject({ datum: '2026-11-18', datumDo: '2026-11-20' })
    expect(udalosti.find((u: { druh: string }) => u.druh === 'PREVZETI')).toMatchObject({ datum: '2026-11-20' })
    // července se týden netýká
    expect(udalosti.some((u: { datum: string }) => u.datum === '2026-07-01')).toBe(false)
    // seřazeno podle dne
    const dny = udalosti.map((u: { datum: string }) => u.datum)
    expect([...dny].sort()).toEqual(dny)
  })

  it('vícedenní realizace začatá před rozsahem je v něm vidět', async () => {
    login(olgaId)
    const { udalosti } = await (await kalendarGet(get('/api/mobile/obchod/kalendar?od=2026-11-19&do=2026-11-19'))).json()
    expect(udalosti.some((u: { druh: string }) => u.druh === 'REALIZACE')).toBe(true)
  })

  it('neplatný nebo příliš dlouhý rozsah → 400', async () => {
    login(olgaId)
    expect((await kalendarGet(get('/api/mobile/obchod/kalendar?od=2026-11-22&do=2026-11-16'))).status).toBe(400)
    expect((await kalendarGet(get('/api/mobile/obchod/kalendar?od=2026-01-01&do=2026-06-01'))).status).toBe(400)
    expect((await kalendarGet(get('/api/mobile/obchod/kalendar?od=x&do=y'))).status).toBe(400)
  })
})

describe('odkaz na odběr kalendáře', () => {
  it('GET vrátí webcal odkaz, POST ho zneplatní a starý feed vrátí 401', async () => {
    login(petrId)
    const prvni = await (await odkazGet(get('/x'))).json()
    expect(prvni.webcal).toMatch(/^webcal:\/\/.+\/api\/calendar\/ics\?uid=/)
    const sig0 = new URL(prvni.https).searchParams.get('sig')!
    expect((await icsGet(get(`/api/calendar/ics?uid=${petrId}&sig=${sig0}`))).status).toBe(200)

    const novy = await (await odkazPost(new Request('http://localhost/x', { method: 'POST' }))).json()
    expect(novy.webcal).not.toBe(prvni.webcal)
    expect((await icsGet(get(`/api/calendar/ics?uid=${petrId}&sig=${sig0}`))).status).toBe(401)
    const sig1 = new URL(novy.https).searchParams.get('sig')!
    expect((await icsGet(get(`/api/calendar/ics?uid=${petrId}&sig=${sig1}`))).status).toBe(200)
  })
})
