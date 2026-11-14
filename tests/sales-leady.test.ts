import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/mobile-auth', () => ({ getMobileSession: vi.fn(async () => null) }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn(async () => {}) }))

import { getServerSession } from 'next-auth'
import { sendPushToUsers } from '@/lib/push'
import { POST as leadyWebPost } from '@/app/api/leady/route'
import { POST as hovorPost } from '@/app/api/hovor/route'
import { GET as leadyGet } from '@/app/api/mobile/obchod/leady/route'
import { GET as leadGet, PATCH as leadPatch } from '@/app/api/mobile/obchod/leady/[id]/route'
import { GET as prevestGet, POST as prevestPost } from '@/app/api/mobile/obchod/leady/[id]/prevest/route'
import { GET as aktivityGet, POST as aktivityPost } from '@/app/api/mobile/obchod/aktivity/route'
import { PATCH as aktivitaPatch } from '@/app/api/mobile/obchod/aktivity/[id]/route'
import { GET as dnesGet } from '@/app/api/mobile/obchod/dnes/route'
import { vytvorLead, prijemciNovehoLeadu, leadPushText } from '@/lib/leadCreate'

/** Felucia Sales Vlna 3: vytvorLead (push po commitu), mobilní API leadů, převod, aktivity u leadu. */

const RUN = `sleady-${Date.now()}`
let orgId: string
let olgaId: string // obchodnice (volající)
let petrId: string // druhý obchodník
let technikId: string

const req = (method: string, body?: unknown, url = 'http://localhost/api/test') =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
const p = (id: string) => ({ params: { id } })
const flush = () => new Promise(r => setTimeout(r, 30))
const pushCalls = () => vi.mocked(sendPushToUsers).mock.calls

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Sales leady', slug: RUN, plan: 'PROFESSIONAL' } })
  orgId = org.id
  const mk = (jmeno: string, role: 'OBCHODNIK' | 'TECHNIK') =>
    prisma.user.create({ data: { orgId, jmeno, email: `${jmeno.toLowerCase()}-${RUN}@example.cz`, role, hesloHash: 'x' } })
  olgaId = (await mk('Olga', 'OBCHODNIK')).id
  petrId = (await mk('Petr', 'OBCHODNIK')).id
  technikId = (await mk('Tomas', 'TECHNIK')).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: olgaId, orgId, role: 'OBCHODNIK', plan: 'PROFESSIONAL' } } as never)
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { orgId } })
  await prisma.activity.deleteMany({ where: { orgId } })
  await prisma.leadNote.deleteMany({ where: { lead: { orgId } } })
  await prisma.lead.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } }).catch(() => {})
})

describe('vytvorLead — komu jde upozornění', () => {
  it('nepřiřazený lead: všichni s obchodem kromě autora, technik ne', async () => {
    const ids = await prijemciNovehoLeadu({ orgId, assignedToId: null }, olgaId)
    expect(ids).toContain(petrId)
    expect(ids).not.toContain(olgaId)
    expect(ids).not.toContain(technikId)
  })

  it('přiřazený lead jen přiřazenému; sám sobě nic', async () => {
    expect(await prijemciNovehoLeadu({ orgId, assignedToId: petrId }, olgaId)).toEqual([petrId])
    expect(await prijemciNovehoLeadu({ orgId, assignedToId: olgaId }, olgaId)).toEqual([])
  })

  it('web lead (bez autora): push do Sales + zvonek, text se službou', async () => {
    vi.mocked(sendPushToUsers).mockClear()
    const { lead, oznam } = await vytvorLead(prisma, {
      orgId, jmeno: 'Jana Webová', zdroj: 'WEB_FORMULAR', status: 'NOVY', sluzba: 'Tepelné čerpadlo',
    }, { autorUserId: null })
    oznam()
    await flush()
    const call = pushCalls().find(c => (c[2].data as { leadId?: string })?.leadId === lead.id)
    expect(call).toBeTruthy()
    expect(call![1].sort()).toEqual([olgaId, petrId].sort())
    expect(call![2]).toMatchObject({ title: 'Nový lead z webu', body: 'Jana Webová · Tepelné čerpadlo', data: { type: 'lead', leadId: lead.id } })
    expect(await prisma.notification.count({ where: { orgId, url: `/leady/${lead.id}` } })).toBe(2)
  })

  it('web lead s vypnutou notifikací: nic', async () => {
    await prisma.orgSettings.upsert({ where: { orgId }, create: { orgId, notifNovyLead: false }, update: { notifNovyLead: false } })
    vi.mocked(sendPushToUsers).mockClear()
    const { oznam } = await vytvorLead(prisma, { orgId, jmeno: 'Tichý', zdroj: 'WEB_FORMULAR', status: 'NOVY' }, { autorUserId: null })
    oznam()
    await flush()
    expect(pushCalls()).toHaveLength(0)
    await prisma.orgSettings.update({ where: { orgId }, data: { notifNovyLead: true } })
  })

  it('ruční lead přiřazený kolegovi z webu → push jen jemu', async () => {
    vi.mocked(sendPushToUsers).mockClear()
    const res = await leadyWebPost(req('POST', { jmeno: 'Pro Petra', assignedToId: petrId }))
    expect(res.status).toBe(201)
    await flush()
    expect(pushCalls()).toHaveLength(1)
    expect(pushCalls()[0][1]).toEqual([petrId])
    expect(pushCalls()[0][2].title).toBe('Přiřazen nový lead')
  })

  it('lead z hovoru (autor = přiřazený) → žádný push', async () => {
    vi.mocked(sendPushToUsers).mockClear()
    const res = await hovorPost(req('POST', { cil: 'LEAD', jmeno: 'Volající Hovorový', telefon: '+420600111222', vysledek: 'chce klimu' }))
    expect(res.status).toBe(201)
    await flush()
    expect(pushCalls()).toHaveLength(0)
  })

  it('leadPushText: firma a první řádek zprávy', () => {
    expect(leadPushText({ jmeno: 'Eva', firma: 'ACME', sluzba: null, zprava: 'Dobrý den\nchci TČ' })).toBe('Eva (ACME) · Dobrý den')
    expect(leadPushText({ jmeno: 'Eva', firma: null, sluzba: null, zprava: null })).toBe('Eva')
  })
})

describe('mobilní API leadů', () => {
  let leadId: string

  beforeAll(async () => {
    const lead = await prisma.lead.create({
      data: { orgId, jmeno: 'Marek Mobilní', telefon: '+420777999888', zdroj: 'WEB_FORMULAR', status: 'NOVY', sluzba: 'klimatizace' },
    })
    leadId = lead.id
  })

  it('seznam: otevřené leady, NOVY nahoře, návrh technologie', async () => {
    const res = await leadyGet(req('GET'))
    expect(res.status).toBe(200)
    const data = await res.json()
    const m = data.find((l: { id: string }) => l.id === leadId)
    expect(m).toMatchObject({ status: 'NOVY', telefon: '+420777999888', navrhTechnologie: 'KLIMA' })
    expect(data[0].status).toBe('NOVY')
  })

  it('STARTER: 403', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: olgaId, orgId, role: 'OBCHODNIK', plan: 'STARTER' } } as never)
    expect((await leadyGet(req('GET'))).status).toBe(403)
  })

  it('technik bez obchodu: 403', async () => {
    vi.mocked(getServerSession).mockResolvedValueOnce({ user: { id: technikId, orgId, role: 'TECHNIK', plan: 'PROFESSIONAL' } } as never)
    expect((await leadyGet(req('GET'))).status).toBe(403)
  })

  it('PATCH: převzít + poznámka, detail je vrátí', async () => {
    expect((await leadPatch(req('PATCH', { prevzit: true, poznamka: 'Volat po 17h' }), p(leadId))).status).toBe(200)
    const d = await (await leadGet(req('GET'), p(leadId))).json()
    expect(d.prirazen).toMatchObject({ id: olgaId })
    expect(d.poznamky[0]).toMatchObject({ text: 'Volat po 17h', autor: 'Olga' })
  })

  it('aktivita u leadu: schůzka ne, uskutečněný hovor → KONTAKTOVAN', async () => {
    const zle = await aktivityPost(req('POST', { leadId, typ: 'SCHUZKA', datum: new Date().toISOString() }))
    expect(zle.status).toBe(400)
    const ok = await aktivityPost(req('POST', { leadId, typ: 'HOVOR', datum: new Date().toISOString(), splneno: true, vysledek: 'zavolat zítra' }))
    expect(ok.status).toBe(201)
    expect((await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).status).toBe('KONTAKTOVAN')
    const feed = await (await aktivityGet(req('GET', undefined, `http://localhost/x?leadId=${leadId}`))).json()
    expect(feed[0]).toMatchObject({ typ: 'HOVOR', vysledek: 'zavolat zítra' })
  })

  it('dealId i leadId zároveň: 400', async () => {
    const deal = await prisma.deal.findFirst({ where: { orgId } })
    if (!deal) return
    expect((await aktivityPost(req('POST', { leadId, dealId: deal.id, typ: 'HOVOR', datum: new Date().toISOString() }))).status).toBe(400)
  })

  it('Dnes: naplánovaný hovor u leadu v leadAktivity, jde splnit', async () => {
    const r = await aktivityPost(req('POST', { leadId, typ: 'HOVOR', datum: new Date().toISOString(), popis: 'domluvit zaměření' }))
    const { id } = await r.json()
    const dnes = await (await dnesGet(req('GET'))).json()
    expect(dnes.leadAktivity.find((a: { id: string }) => a.id === id)).toMatchObject({ lead: { id: leadId, jmeno: 'Marek Mobilní' } })
    expect((await aktivitaPatch(req('PATCH', { splneno: true }), p(id))).status).toBe(200)
  })

  it('zamítnout a znovu otevřít', async () => {
    const l2 = await prisma.lead.create({ data: { orgId, jmeno: 'Zamítaný', zdroj: 'RUCNE', status: 'NOVY' } })
    expect((await leadPatch(req('PATCH', { status: 'ZRUSEN', duvodZruseni: 'jen cena' }), p(l2.id))).status).toBe(200)
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: l2.id } })).toMatchObject({ status: 'ZRUSEN', duvodZruseni: 'jen cena' })
    expect((await leadPatch(req('PATCH', { status: 'KVALIFIKOVAN' }), p(l2.id))).status).toBe(400)
    expect((await leadPatch(req('PATCH', { status: 'NOVY' }), p(l2.id))).status).toBe(200)
    expect((await leadPatch(req('PATCH', { status: 'PREVEDEN' }), p(l2.id))).status).toBe(400)
  })

  it('převod: kandidát podle telefonu, OP s aktivitami, podruhé 400, pozdní offline hovor jde k OP', async () => {
    const klient = await prisma.client.create({
      data: { orgId, typKlienta: 'FYZICKA_OSOBA', jmeno: 'Marek', prijmeni: 'Mobilní', telefon: '777 999 888' },
    })
    const k = await (await prevestGet(req('GET'), p(leadId))).json()
    expect(k.kandidat).toMatchObject({ id: klient.id, duvod: 'telefon' })

    const res = await prevestPost(req('POST', { technologie: 'KLIMA', predmet: 'Klima obývák', existingClientId: klient.id }), p(leadId))
    expect(res.status).toBe(201)
    const { dealId } = await res.json()
    const deal = await prisma.deal.findUniqueOrThrow({ where: { id: dealId } })
    expect(deal).toMatchObject({ clientId: klient.id, userId: olgaId, technologie: 'KLIMA', predmet: 'Klima obývák' })
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: leadId } })).toMatchObject({ status: 'PREVEDEN', prevedenNaOpId: dealId })
    expect(await prisma.activity.count({ where: { leadId } })).toBe(0)
    expect(await prisma.activity.count({ where: { dealId } })).toBeGreaterThanOrEqual(2)

    expect((await prevestPost(req('POST', {}), p(leadId))).status).toBe(400)

    // hovor zapsaný offline před převodem, odeslaný až po něm
    const pozde = await aktivityPost(req('POST', { leadId, typ: 'HOVOR', datum: new Date().toISOString(), splneno: true }))
    expect(pozde.status).toBe(201)
    const a = await prisma.activity.findUniqueOrThrow({ where: { id: (await pozde.json()).id } })
    expect(a).toMatchObject({ dealId, leadId: null })
  })
})
