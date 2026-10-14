import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as stavPost } from '@/app/api/quotes/[id]/stav/route'
import { PATCH as dealPatch } from '@/app/api/deals/[id]/route'
import { GET as notifGet } from '@/app/api/notifications/list/route'
import { dataOdeslani, NABIDKA_VISI_PO_DNECH } from '@/lib/quoteStav'
import { sweepNabidkyFollowUp } from '@/worker/followupy'

// Procesní mapa NANTO 4.1: stav nabídky (odmítnutí bez důvodu) + 1.6: důvod povinný u prohraného OP
const RUN = `nabstav-${Date.now()}`

let orgId: string
let userId: string
let clientId: string

const req = (method: string, body?: unknown) =>
  new Request('http://localhost/api/test', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })

function mockRole(role: 'ADMIN' | 'OBCHODNIK' | 'TECHNIK') {
  vi.mocked(getServerSession).mockResolvedValue({
    user: { id: userId, orgId, role, plan: 'PROFESSIONAL' },
  } as never)
}

async function novyOp(stav: 'NABIDKA' | 'PAS' = 'NABIDKA') {
  return prisma.deal.create({
    data: { orgId, clientId, userId, stav, technologie: 'KLIMA', kod: `OP-${RUN}-${Math.random().toString(36).slice(2, 7)}` },
  })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Nabídka stav', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const user = await prisma.user.create({
    data: { orgId, jmeno: 'Olga Obchodní', email: `olga-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  userId = user.id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Váhavý', telefon: '601000111' } })
  clientId = klient.id
  mockRole('OBCHODNIK')
})

afterAll(async () => {
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

describe('stav nabídky', () => {
  it('nová nabídka je rozpracovaná, ruční „odeslaná“ nastaví odeslanoAt', async () => {
    const deal = await novyOp()
    const q = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'A' } })
    expect(q.stav).toBe('ROZPRACOVANA')

    const res = await stavPost(req('POST', { stav: 'ODESLANA' }), { params: { id: q.id } })
    expect(res.status).toBe(200)
    const po = await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })
    expect(po.stav).toBe('ODESLANA')
    expect(po.odeslanoAt).toBeTruthy()
    expect(po.stavZmenen).toBeTruthy()

    // Záznam do historie OP
    const akt = await prisma.activity.findFirst({ where: { dealId: deal.id, popis: { contains: 'odeslaná' } } })
    expect(akt?.stav).toBe('DOKONCENA')
  })

  it('odmítnutí nevyžaduje důvod, OP zůstává ve svém stavu', async () => {
    const deal = await novyOp()
    const q = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'B', stav: 'ODESLANA', odeslanoAt: new Date() } })

    const res = await stavPost(req('POST', { stav: 'ODMITNUTA' }), { params: { id: q.id } })
    expect(res.status).toBe(200)
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).stav).toBe('ODMITNUTA')
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).stav).toBe('NABIDKA')

    // Oprava omylu zpět na odeslanou
    const zpet = await stavPost(req('POST', { stav: 'ODESLANA' }), { params: { id: q.id } })
    expect(zpet.status).toBe(200)
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: q.id } })).stav).toBe('ODESLANA')
  })

  it('akceptace nastaví nabídku jako jedinou aktivní', async () => {
    const deal = await novyOp()
    const a = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'A', aktivni: true, stav: 'ODESLANA', odeslanoAt: new Date() } })
    const b = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'B', stav: 'ODESLANA', odeslanoAt: new Date() } })

    const res = await stavPost(req('POST', { stav: 'AKCEPTOVANA' }), { params: { id: b.id } })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ stav: 'AKCEPTOVANA', aktivni: true })
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: a.id } })).aktivni).toBe(false)
  })

  it('nepovolené přechody a neplatný stav → 400', async () => {
    const deal = await novyOp()
    const q = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'C' } })
    expect((await stavPost(req('POST', { stav: 'AKCEPTOVANA' }), { params: { id: q.id } })).status).toBe(400)
    expect((await stavPost(req('POST', { stav: 'ODMITNUTA' }), { params: { id: q.id } })).status).toBe(400)
    expect((await stavPost(req('POST', { stav: 'SMAZANA' }), { params: { id: q.id } })).status).toBe(400)
  })

  it('technik bez obchodu stav nemění', async () => {
    const deal = await novyOp()
    const q = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'D' } })
    mockRole('TECHNIK')
    try {
      expect((await stavPost(req('POST', { stav: 'ODESLANA' }), { params: { id: q.id } })).status).toBe(403)
    } finally {
      mockRole('OBCHODNIK')
    }
  })

  it('opakované odeslání restartuje odpočet, akceptovanou nechá akceptovanou', () => {
    const t = new Date('2026-10-14T10:00:00Z')
    expect(dataOdeslani('ODESLANA', 'EMAIL', t)).toMatchObject({ stav: 'ODESLANA', odeslanoAt: t, followUpAt: null })
    const akc = dataOdeslani('AKCEPTOVANA', 'SMS', t)
    expect(akc.stav).toBeUndefined()
    expect(akc.odeslanoAt).toBe(t)
  })
})

describe('visící odeslané nabídky', () => {
  it('Co mám dělat ukáže moje nabídky odeslané před 7+ dny; worker pošle jednorázový bell', async () => {
    const stara = new Date(Date.now() - (NABIDKA_VISI_PO_DNECH + 1) * 24 * 3600_000)
    const deal = await novyOp()
    const visi = await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'Visí', kod: `NAB-${RUN}`, stav: 'ODESLANA', odeslanoAt: stara } })
    // Čerstvá a odmítnutá nevisí
    await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'Čerstvá', stav: 'ODESLANA', odeslanoAt: new Date() } })
    await prisma.quote.create({ data: { orgId, dealId: deal.id, nazev: 'Odmítnutá', stav: 'ODMITNUTA', odeslanoAt: stara } })

    const data = await (await notifGet(req('GET'))).json()
    expect(data.visiciNabidky.map((q: { id: string }) => q.id)).toEqual([visi.id])
    expect(data.visiciNabidky[0].dni).toBeGreaterThanOrEqual(NABIDKA_VISI_PO_DNECH)

    const pocetPred = await prisma.notification.count({ where: { orgId, typ: 'NABIDKA_FOLLOWUP' } })
    await sweepNabidkyFollowUp(prisma)
    expect((await prisma.quote.findUniqueOrThrow({ where: { id: visi.id } })).followUpAt).toBeTruthy()
    expect(await prisma.notification.count({ where: { orgId, typ: 'NABIDKA_FOLLOWUP' } })).toBe(pocetPred + 1)
  })
})

describe('prohraný OP (web PATCH)', () => {
  it('PAS bez důvodu → 400, s kódem projde a uloží se', async () => {
    const deal = await novyOp()
    const bez = await dealPatch(req('PATCH', { stav: 'PAS' }), { params: { id: deal.id } })
    expect(bez.status).toBe(400)
    expect((await bez.json()).code).toBe('DUVOD_PROHRY')
    // Jen volný text bez kódu nestačí
    expect((await dealPatch(req('PATCH', { stav: 'PAS', duvodProhry: 'drahé' }), { params: { id: deal.id } })).status).toBe(400)

    const s = await dealPatch(req('PATCH', { stav: 'PAS', duvodProhryKod: 'KONKURENCE', duvodProhry: ' levnější montážník ' }), { params: { id: deal.id } })
    expect(s.status).toBe(200)
    const po = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })
    expect(po).toMatchObject({ stav: 'PAS', duvodProhryKod: 'KONKURENCE', duvodProhry: 'levnější montážník' })
  })

  it('úprava jiných polí u už prohraného OP důvod nechce; návrat z PAS důvod smaže', async () => {
    const deal = await novyOp()
    await prisma.deal.update({ where: { id: deal.id }, data: { stav: 'PAS', duvodProhryKod: 'CENA' } })
    expect((await dealPatch(req('PATCH', { stav: 'PAS', predmet: 'Klima obývák' }), { params: { id: deal.id } })).status).toBe(200)
    expect((await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })).duvodProhryKod).toBe('CENA')

    expect((await dealPatch(req('PATCH', { stav: 'JEDNANI' }), { params: { id: deal.id } })).status).toBe(200)
    const po = await prisma.deal.findUniqueOrThrow({ where: { id: deal.id } })
    expect(po).toMatchObject({ stav: 'JEDNANI', duvodProhryKod: null, duvodProhry: null })
  })
})
