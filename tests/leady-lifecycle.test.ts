import { describe, it, expect, beforeAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { PATCH as leadPatch, DELETE as leadDelete } from '@/app/api/leady/[id]/route'
import { POST as leadConvert } from '@/app/api/leady/[id]/convert/route'
import { POST as leadCancel } from '@/app/api/leady/[id]/cancel/route'
import { POST as leadReopen } from '@/app/api/leady/[id]/reopen/route'
import { getServerSession } from 'next-auth'

const RUN = `leady-lifecycle-${Date.now()}`

let orgId: string
let adminId: string
let obchodnikId: string

async function novyLead(data: Record<string, unknown> = {}) {
  const lead = await prisma.lead.create({ data: { orgId, jmeno: 'Testovací lead', ...data } })
  return lead.id
}

function jakoAdmin() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
}

function jakoObchodnik() {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: obchodnikId, orgId, role: 'OBCHODNIK' } } as never)
}

function post(id: string, body: Record<string, unknown> = {}) {
  return new Request(`http://localhost/api/leady/${id}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function patch(id: string, body: Record<string, unknown>) {
  return new Request(`http://localhost/api/leady/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Leady Lifecycle', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const admin = await prisma.user.create({
    data: { orgId, jmeno: 'Adéla Adminová', email: `admin-${RUN}@example.cz`, role: 'ADMIN', hesloHash: 'x' },
  })
  adminId = admin.id
  const obchodnik = await prisma.user.create({
    data: { orgId, jmeno: 'Petr Obchodník', email: `petr-${RUN}@example.cz`, role: 'OBCHODNIK', hesloHash: 'x' },
  })
  obchodnikId = obchodnik.id
  jakoAdmin()
})

describe('DELETE /api/leady/[id]', () => {
  it('admin lead smaže i s poznámkami', async () => {
    const id = await novyLead()
    await prisma.leadNote.create({ data: { leadId: id, userId: adminId, text: 'poznámka' } })

    jakoAdmin()
    const res = await leadDelete(new Request('http://localhost'), { params: { id } })
    expect(res.status).toBe(200)

    expect(await prisma.lead.findUnique({ where: { id } })).toBeNull()
    expect(await prisma.leadNote.count({ where: { leadId: id } })).toBe(0)
  })

  it('obchodník mazat nesmí', async () => {
    const id = await novyLead()
    jakoObchodnik()
    const res = await leadDelete(new Request('http://localhost'), { params: { id } })
    expect(res.status).toBe(403)
    expect(await prisma.lead.findUnique({ where: { id } })).not.toBeNull()
    jakoAdmin()
  })

  it('smazání převedeného leadu nechá OP i klienta být', async () => {
    const id = await novyLead({ jmeno: 'Klient K Převodu', sluzba: 'klimatizace' })
    const convert = await leadConvert(post(id, {}), { params: { id } })
    expect(convert.status).toBe(201)
    const { dealId, clientId } = await convert.json()

    const res = await leadDelete(new Request('http://localhost'), { params: { id } })
    expect(res.status).toBe(200)
    expect(await prisma.deal.findUnique({ where: { id: dealId } })).not.toBeNull()
    expect(await prisma.client.findUnique({ where: { id: clientId } })).not.toBeNull()
  })
})

describe('status leadu odpovídá skutečnosti', () => {
  it('převod nastaví PREVEDEN i vazbu na OP a klienta', async () => {
    const id = await novyLead({ sluzba: 'rekuperace' })
    const res = await leadConvert(post(id, {}), { params: { id } })
    expect(res.status).toBe(201)
    const { dealId, clientId } = await res.json()

    const lead = await prisma.lead.findUnique({ where: { id } })
    expect(lead?.status).toBe('PREVEDEN')
    expect(lead?.prevedenNaOpId).toBe(dealId)
    expect(lead?.prevedenNaKlientId).toBe(clientId)
  })

  it('převod odvodí technologii a předmět ze služby', async () => {
    const id = await novyLead({ sluzba: 'klimatizace', zprava: 'Cokoliv' })
    const res = await leadConvert(post(id, {}), { params: { id } })
    const { dealId } = await res.json()

    const deal = await prisma.deal.findUnique({ where: { id: dealId } })
    expect(deal?.technologie).toBe('KLIMA')
    expect(deal?.predmet).toBe('Klimatizace')
  })

  it('PATCH nesmí nastavit PREVEDEN bez převodu', async () => {
    const id = await novyLead()
    const res = await leadPatch(patch(id, { status: 'PREVEDEN' }), { params: { id } })
    expect(res.status).toBe(400)
    expect((await prisma.lead.findUnique({ where: { id } }))?.status).toBe('NOVY')
  })

  it('PATCH nesmí nastavit ZRUSEN bez důvodu přes cancel', async () => {
    const id = await novyLead()
    const res = await leadPatch(patch(id, { status: 'ZRUSEN' }), { params: { id } })
    expect(res.status).toBe(400)
    expect((await prisma.lead.findUnique({ where: { id } }))?.status).toBe('NOVY')
  })

  it('uzavřený lead nejde PATCHem vrátit do pipeline', async () => {
    const id = await novyLead()
    await leadCancel(post(id, { duvodZruseni: 'mimo region' }), { params: { id } })
    const res = await leadPatch(patch(id, { status: 'KONTAKTOVAN' }), { params: { id } })
    expect(res.status).toBe(400)
  })

  it('zamítnutý lead jde znovu otevřít, převedený ne', async () => {
    const zamitnuty = await novyLead()
    await leadCancel(post(zamitnuty, { duvodZruseni: 'nezájem' }), { params: { id: zamitnuty } })
    const res = await leadReopen(post(zamitnuty), { params: { id: zamitnuty } })
    expect(res.status).toBe(200)
    const lead = await prisma.lead.findUnique({ where: { id: zamitnuty } })
    expect(lead?.status).toBe('NOVY')
    expect(lead?.duvodZruseni).toBeNull()

    const prevedeny = await novyLead()
    await leadConvert(post(prevedeny, {}), { params: { id: prevedeny } })
    const res2 = await leadReopen(post(prevedeny), { params: { id: prevedeny } })
    expect(res2.status).toBe(400)
  })

  it('dvojí převod téhož leadu skončí chybou, ne druhým OP', async () => {
    const id = await novyLead()
    await leadConvert(post(id, {}), { params: { id } })
    const pocetPredDruhym = await prisma.deal.count({ where: { orgId } })

    const res = await leadConvert(post(id, {}), { params: { id } })
    expect(res.status).toBe(400)
    expect(await prisma.deal.count({ where: { orgId } })).toBe(pocetPredDruhym)
  })
})
