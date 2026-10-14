import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as hovorPost } from '@/app/api/hovor/route'
import { GET as najitGet } from '@/app/api/hovor/najit/route'
import { getServerSession } from 'next-auth'

const RUN = `hovor-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let klientId: string
let dealId: string
let leadId: string
let ciziDealId: string

function loginAs(userId: string, role = 'ADMIN', plan = 'STANDARD', org = orgId) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role, plan } } as never)
}
const post = (body: unknown) => hovorPost(new Request('http://test', { method: 'POST', body: JSON.stringify(body) }))
const najit = (tel: string) => najitGet(new Request(`http://test/api/hovor/najit?tel=${encodeURIComponent(tel)}`))
const zitra = () => new Date(Date.now() + 86_400_000).toISOString()

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test hovor', slug: RUN, plan: 'STANDARD' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  klientId = (await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Volající', telefon: '+420 777 111 222' } })).id
  dealId = (await prisma.deal.create({ data: { orgId, clientId: klientId, kod: `${RUN}-OP`, predmet: 'Klima', technologie: 'KLIMA' } })).id
  leadId = (await prisma.lead.create({ data: { orgId, jmeno: 'Lea Leadová', telefon: '602 333 444', status: 'NOVY' } })).id
  const ciziKlient = await prisma.client.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', prijmeni: 'K', telefon: '777111222' } })
  ciziDealId = (await prisma.deal.create({ data: { orgId: ciziOrgId, clientId: ciziKlient.id, kod: `${RUN}-C`, technologie: 'KLIMA' } })).id
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.auditLog.deleteMany({ where: { orgId: org } })
    await prisma.activity.deleteMany({ where: { orgId: org } })
    await prisma.lead.deleteMany({ where: { orgId: org } })
    await prisma.deal.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } }).catch(() => {})
  }
})

describe('najít volajícího', () => {
  it('najde klienta s otevřeným OP a lead podle čísla v jiném formátu, cizí org ne', async () => {
    loginAs(adminId)
    const k = await (await najit('777111222')).json()
    expect(k.klienti).toHaveLength(1)
    expect(k.klienti[0]).toMatchObject({ id: klientId, nazev: 'Karel Volající' })
    expect(k.klienti[0].otevreneOp.map((o: { id: string }) => o.id)).toEqual([dealId])

    const l = await (await najit('+420602333444')).json()
    expect(l.leady.map((x: { id: string }) => x.id)).toEqual([leadId])
    expect(l.klienti).toEqual([])
  })
})

describe('zapsat hovor', () => {
  it('k existujícímu OP: hotový hovor + naplánovaný další krok', async () => {
    loginAs(adminId)
    const res = await post({ cil: 'OP', dealId, poznamka: 'Chce termín', dalsiKrok: { typ: 'SCHUZKA', datum: zitra() } })
    expect(res.status).toBe(201)
    const akt = await prisma.activity.findMany({ where: { dealId }, orderBy: { vytvoreno: 'asc' } })
    expect(akt.map(a => [a.typ, a.stav, a.vysledek])).toEqual([
      ['HOVOR', 'DOKONCENA', 'Chce termín'],
      ['SCHUZKA', 'PLANOVANA', null],
    ])
  })

  it('k cizímu OP nejde', async () => {
    loginAs(adminId)
    expect((await post({ cil: 'OP', dealId: ciziDealId })).status).toBe(404)
  })

  it('ke stávajícímu leadu: lead NOVY → KONTAKTOVAN, schůzka na leadu nejde', async () => {
    loginAs(adminId)
    expect((await post({ cil: 'LEAD', leadId, dalsiKrok: { typ: 'SCHUZKA', datum: zitra() } })).status).toBe(400)
    const res = await post({ cil: 'LEAD', leadId, poznamka: 'Ozve se', dalsiKrok: { typ: 'HOVOR', datum: zitra(), popis: 'Je to aktuální?' } })
    expect(res.status).toBe(201)
    expect((await prisma.lead.findUnique({ where: { id: leadId } }))?.status).toBe('KONTAKTOVAN')
    const akt = await prisma.activity.findMany({ where: { leadId }, orderBy: { vytvoreno: 'asc' } })
    expect(akt.map(a => [a.typ, a.stav])).toEqual([['HOVOR', 'DOKONCENA'], ['HOVOR', 'PLANOVANA']])
  })

  it('nový lead z hovoru; na plánu STARTER leady nejdou', async () => {
    loginAs(adminId)
    const res = await post({ cil: 'LEAD', jmeno: 'Nový Volající', telefon: '608 999 000', poznamka: 'Zajímá ho TČ' })
    expect(res.status).toBe(201)
    const { leadId: novy } = await res.json()
    expect(await prisma.lead.findUnique({ where: { id: novy } })).toMatchObject({ status: 'KONTAKTOVAN', telefon: '608 999 000', assignedToId: adminId })

    loginAs(adminId, 'ADMIN', 'STARTER')
    expect((await post({ cil: 'LEAD', jmeno: 'X' })).status).toBe(403)
  })

  it('rovnou nový OP: nový klient, převod leadu s historií', async () => {
    loginAs(adminId)
    expect((await post({ cil: 'NOVY_OP', jmeno: 'Bez Technologie' })).status).toBe(400)

    const res = await post({ cil: 'NOVY_OP', jmeno: 'Petr Nový', telefon: '603 000 111', technologie: 'TEPELNE_CERPADLO', predmet: 'TČ do RD', dalsiKrok: { typ: 'SCHUZKA', datum: zitra() } })
    expect(res.status).toBe(201)
    const { dealId: novyOp, clientId } = await res.json()
    expect(await prisma.client.findUnique({ where: { id: clientId } })).toMatchObject({ jmeno: 'Petr', prijmeni: 'Nový', telefon: '603 000 111' })
    expect(await prisma.activity.count({ where: { dealId: novyOp } })).toBe(2)

    const prevod = await post({ cil: 'NOVY_OP', leadId, jmeno: 'Lea Leadová', technologie: 'KLIMA' })
    expect(prevod.status).toBe(201)
    const { dealId: opZLeadu } = await prevod.json()
    expect(await prisma.lead.findUnique({ where: { id: leadId } })).toMatchObject({ status: 'PREVEDEN', prevedenNaOpId: opZLeadu })
    // 2 aktivity z leadu + nový hovor
    expect(await prisma.activity.count({ where: { dealId: opZLeadu } })).toBe(3)
  })
})
