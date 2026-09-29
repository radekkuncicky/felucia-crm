import { describe, it, expect, beforeAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/mobile-auth', () => ({ getMobileSession: vi.fn(async () => null) }))

import { POST as activityPost } from '@/app/api/activities/route'
import { PATCH as activityPatch } from '@/app/api/activities/[id]/route'
import { PATCH as dealActivityPatch } from '@/app/api/deals/[id]/activities/[actId]/route'
import { POST as leadConvert } from '@/app/api/leady/[id]/convert/route'
import { DELETE as leadDelete } from '@/app/api/leady/[id]/route'
import { GET as ukolyGet } from '@/app/api/dashboard/ukoly/route'
import { getServerSession } from 'next-auth'

/**
 * Aktivity na leadu (jen HOVOR/EMAIL), follow-up při dokončení a přesun
 * aktivit při převodu leadu na OP.
 */

const RUN = `lead-act-${Date.now()}`

let orgId: string
let adminId: string
let dealId: string

function jako(plan = 'STANDARD') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN', plan } } as never)
}

function req(method: string, body: unknown) {
  return new Request('http://localhost/api/x', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

async function novyLead(data: Record<string, unknown> = {}) {
  return (await prisma.lead.create({ data: { orgId, jmeno: 'Lenka Leadová', ...data } })).id
}

async function leadAktivita(leadId: string, body: Record<string, unknown> = {}) {
  jako()
  const res = await activityPost(req('POST', { leadId, typ: 'HOVOR', datum: '2026-10-01', ...body }))
  return { res, json: await res.json() }
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Lead Aktivity', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Adam Admin', email: `admin-${RUN}@example.cz`, role: 'ADMIN', hesloHash: 'x' },
  })).id
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  dealId = (await prisma.deal.create({
    data: { orgId, clientId: client.id, technologie: 'KLIMA', kod: `OP-${RUN}` },
  })).id
  jako()
})

describe('POST /api/activities s leadId', () => {
  it('založí hovor na leadu, řešitel = autor', async () => {
    const leadId = await novyLead()
    const { res, json } = await leadAktivita(leadId, { popis: 'Zavolat kvůli nabídce', cas: '10:00' })
    expect(res.status).toBe(201)
    expect(json.leadId).toBe(leadId)
    expect(json.dealId).toBeNull()
    expect(json.resitelId).toBe(adminId)
    expect(json.cas).toBe('10:00')
  })

  it('na leadu jen hovor a e-mail', async () => {
    const leadId = await novyLead()
    expect((await leadAktivita(leadId, { typ: 'EMAIL' })).res.status).toBe(201)
    expect((await leadAktivita(leadId, { typ: 'SCHUZKA' })).res.status).toBe(400)
    expect((await leadAktivita(leadId, { typ: 'NESMYSL' })).res.status).toBe(400)
  })

  it('přesně jeden rodič', async () => {
    const leadId = await novyLead()
    jako()
    const oba = await activityPost(req('POST', { leadId, dealId, typ: 'HOVOR', datum: '2026-10-01' }))
    expect(oba.status).toBe(400)
    const zadny = await activityPost(req('POST', { typ: 'HOVOR', datum: '2026-10-01' }))
    expect(zadny.status).toBe(400)
  })

  it('STARTER aktivity na leadu nezaloží', async () => {
    const leadId = await novyLead()
    jako('STARTER')
    const res = await activityPost(req('POST', { leadId, typ: 'HOVOR', datum: '2026-10-01' }))
    expect(res.status).toBe(403)
    jako()
  })

  it('na uzavřeném leadu nejde založit', async () => {
    const leadId = await novyLead({ status: 'ZRUSEN' })
    expect((await leadAktivita(leadId)).res.status).toBe(400)
  })

  it('cizí lead → 404', async () => {
    const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })
    const ciziLead = await prisma.lead.create({ data: { orgId: cizi.id, jmeno: 'Cizí lead' } })
    expect((await leadAktivita(ciziLead.id)).res.status).toBe(404)
    await prisma.lead.delete({ where: { id: ciziLead.id } })
    await prisma.organization.delete({ where: { id: cizi.id } })
  })
})

describe('PATCH s followUp', () => {
  it('dokončení na leadu naplánuje navazující e-mail na stejném leadu', async () => {
    const leadId = await novyLead()
    const { json: act } = await leadAktivita(leadId)
    jako()
    const res = await activityPatch(
      req('PATCH', { stav: 'DOKONCENA', vysledek: 'Chce nabídku', followUp: { typ: 'EMAIL', datum: '2026-10-05', popis: 'Poslat nabídku' } }),
      { params: { id: act.id } },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.stav).toBe('DOKONCENA')
    expect(json.splneno).toBe(true)
    expect(json.vysledek).toBe('Chce nabídku')
    expect(json.followUp.leadId).toBe(leadId)
    expect(json.followUp.typ).toBe('EMAIL')
    expect(json.followUp.popis).toBe('Poslat nabídku')
    expect(json.followUp.stav).toBe('PLANOVANA')
    expect(json.followUp.resitelId).toBe(adminId)
  })

  it('na leadu nejde naplánovat schůzku ani přepnout typ', async () => {
    const leadId = await novyLead()
    const { json: act } = await leadAktivita(leadId)
    jako()
    const res = await activityPatch(
      req('PATCH', { stav: 'DOKONCENA', followUp: { typ: 'SCHUZKA', datum: '2026-10-05' } }),
      { params: { id: act.id } },
    )
    expect(res.status).toBe(400)
    // transakce nic nezapsala
    expect((await prisma.activity.findUnique({ where: { id: act.id } }))?.stav).toBe('PLANOVANA')

    const typ = await activityPatch(req('PATCH', { typ: 'UKOL' }), { params: { id: act.id } })
    expect(typ.status).toBe(400)
  })

  it('followUp bez dokončení je chyba', async () => {
    const leadId = await novyLead()
    const { json: act } = await leadAktivita(leadId)
    jako()
    const res = await activityPatch(
      req('PATCH', { followUp: { typ: 'HOVOR', datum: '2026-10-05' } }),
      { params: { id: act.id } },
    )
    expect(res.status).toBe(400)
  })

  it('na OP přes deal route vytvoří navazující aktivitu na stejném OP', async () => {
    const act = await prisma.activity.create({
      data: { orgId, dealId, userId: adminId, resitelId: adminId, typ: 'HOVOR', datum: new Date() },
    })
    jako()
    const res = await dealActivityPatch(
      req('PATCH', { stav: 'DOKONCENA', followUp: { typ: 'SCHUZKA', datum: '2026-10-07' } }),
      { params: { id: dealId, actId: act.id } },
    )
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.followUp.dealId).toBe(dealId)
    expect(json.followUp.leadId).toBeNull()
    expect(json.followUp.typ).toBe('SCHUZKA')
  })
})

describe('převod a smazání leadu', () => {
  it('převod leadu přesune aktivity na nový OP', async () => {
    const leadId = await novyLead({ sluzba: 'klimatizace' })
    const { json: a1 } = await leadAktivita(leadId)
    const { json: a2 } = await leadAktivita(leadId, { typ: 'EMAIL' })
    jako()
    const res = await leadConvert(req('POST', {}), { params: { id: leadId } })
    expect(res.status).toBe(201)
    const { dealId: noveOp } = await res.json()

    const moved = await prisma.activity.findMany({ where: { id: { in: [a1.id, a2.id] } } })
    expect(moved).toHaveLength(2)
    for (const a of moved) {
      expect(a.dealId).toBe(noveOp)
      expect(a.leadId).toBeNull()
    }
  })

  it('smazání leadu smaže i jeho aktivity', async () => {
    const leadId = await novyLead()
    const { json: act } = await leadAktivita(leadId)
    jako()
    const res = await leadDelete(new Request('http://localhost'), { params: { id: leadId } })
    expect(res.status).toBe(200)
    expect(await prisma.activity.findUnique({ where: { id: act.id } })).toBeNull()
  })
})

describe('Co mám dělat', () => {
  it('obsahuje aktivitu leadu s odkazem na lead', async () => {
    const leadId = await novyLead({ jmeno: 'Dana Dashboardová', firma: 'Dana s.r.o.' })
    const dnes = new Date().toISOString().split('T')[0]
    const { json: act } = await leadAktivita(leadId, { datum: dnes, popis: 'Zavolat Daně' })
    jako()
    const res = await ukolyGet(new Request('http://localhost/api/dashboard/ukoly'))
    const { polozky } = await res.json()
    const p = polozky.find((x: { id: string }) => x.id === act.id)
    expect(p).toBeTruthy()
    expect(p.leadId).toBe(leadId)
    expect(p.kontext.href).toBe(`/leady/${leadId}`)
    expect(p.kontext.popis).toContain('Dana Dashboardová')
  })
})
