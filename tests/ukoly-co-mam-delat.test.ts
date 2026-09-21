import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/mobile-auth', () => ({ getMobileSession: vi.fn(async () => null) }))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST as ukolyPost, GET as ukolyGet } from '@/app/api/zakazky/[id]/ukoly/route'
import { PATCH as ukolPatch, DELETE as ukolDelete } from '@/app/api/zakazky/[id]/ukoly/[ukolId]/route'
import { GET as coMamDelat } from '@/app/api/dashboard/ukoly/route'
import { zaPracovnichDni } from '@/lib/kontrolniKontakt'
import { parseUkolInput } from '@/lib/zakazkaUkol'

/**
 * Úkolník zakázky + dashboard „Co mám dělat“ nad nanto_crm_test:
 * CRUD úkolu, odškrtnutí, řazení do skupin podle termínu, tenant guard.
 */

const RUN = `ukoly-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let kolegaId: string
let ciziAdminId: string
let zakazkaId: string
let dealId: string

function loginAs(userId: string, org: string, role = 'ADMIN') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role, plan: 'PROFESSIONAL' } } as never)
}
const json = (url: string, body: unknown, method = 'POST') => new Request(url, { method, body: JSON.stringify(body) })

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Úkoly', slug: RUN, plan: 'PROFESSIONAL' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  kolegaId = (await prisma.user.create({ data: { orgId, jmeno: 'Kolega', email: `${RUN}-k@example.com`, hesloHash: 'x', role: 'OBCHODNIK' } })).id
  ciziAdminId = (await prisma.user.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', email: `${RUN}-c@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id

  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Novák' } })
  zakazkaId = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-Z1`, nazev: 'TČ Novák', klientId: klient.id, vedouciId: adminId, stav: 'V_REALIZACI' },
  })).id
  dealId = (await prisma.deal.create({ data: { orgId, clientId: klient.id, technologie: 'KLIMA', kod: `${RUN}-OP`, userId: adminId } })).id
})

afterAll(async () => {
  for (const id of [orgId, ciziOrgId]) {
    await prisma.zakazkaUkol.deleteMany({ where: { orgId: id } })
    await prisma.activity.deleteMany({ where: { orgId: id } })
    await prisma.zakazka.deleteMany({ where: { orgId: id } })
    await prisma.deal.deleteMany({ where: { orgId: id } })
    await prisma.client.deleteMany({ where: { orgId: id } })
    await prisma.user.deleteMany({ where: { orgId: id } })
    await prisma.organization.delete({ where: { id } })
  }
})

describe('parseUkolInput', () => {
  it('vyžaduje text, termín přijme YYYY-MM-DD i prázdný', () => {
    expect(parseUkolInput({})).toEqual({ error: 'Text úkolu je povinný' })
    expect(parseUkolInput({ text: ' Objednat ', termin: '2026-10-01' })).toMatchObject({ data: { text: 'Objednat', termin: new Date('2026-10-01') } })
    expect(parseUkolInput({ text: 'x', termin: '' })).toMatchObject({ data: { termin: null } })
    expect(parseUkolInput({ text: 'x', termin: 'nedatum' })).toEqual({ error: 'Neplatný termín' })
  })
  it('partial: neřeší chybějící text', () => {
    expect(parseUkolInput({ termin: null }, { partial: true })).toEqual({ data: { termin: null } })
  })
})

describe('zaPracovnichDni', () => {
  it('přeskakuje víkend', () => {
    // pátek 2026-09-25 + 3 pracovní dny = středa 2026-09-30
    const d = zaPracovnichDni(3, new Date('2026-09-25T12:00:00'))
    expect(d.getDay()).toBe(3)
    expect(d.getDate()).toBe(30)
    expect(d.getHours()).toBe(9)
  })
})

describe('úkolník zakázky', () => {
  let ukolId: string

  it('POST vytvoří úkol s pořadím a řešitelem', async () => {
    loginAs(adminId, orgId)
    const res = await ukolyPost(json('http://t/api', { text: 'Objednat jednotku', termin: '2026-01-01', resitelId: kolegaId }), { params: { id: zakazkaId } })
    expect(res.status).toBe(201)
    const u = await res.json()
    ukolId = u.id
    expect(u.poradi).toBe(1)
    expect(u.resitel.jmeno).toBe('Kolega')
    expect(u.hotovo).toBe(false)
  })

  it('POST odmítne řešitele z cizí org', async () => {
    loginAs(adminId, orgId)
    const res = await ukolyPost(json('http://t/api', { text: 'x', resitelId: ciziAdminId }), { params: { id: zakazkaId } })
    expect(res.status).toBe(400)
  })

  it('cizí org zakázku nevidí (403)', async () => {
    loginAs(ciziAdminId, ciziOrgId)
    const res = await ukolyGet(new Request('http://t/api'), { params: { id: zakazkaId } })
    expect(res.status).toBe(403)
  })

  it('PATCH hotovo zapíše hotovoAt + hotovoId', async () => {
    loginAs(adminId, orgId)
    const res = await ukolPatch(json('http://t/api', { hotovo: true }, 'PATCH'), { params: { id: zakazkaId, ukolId } })
    expect(res.status).toBe(200)
    const db = await prisma.zakazkaUkol.findUnique({ where: { id: ukolId } })
    expect(db?.hotovo).toBe(true)
    expect(db?.hotovoId).toBe(adminId)
    expect(db?.hotovoAt).toBeTruthy()

    const back = await ukolPatch(json('http://t/api', { hotovo: false, text: 'Objednat venkovní jednotku' }, 'PATCH'), { params: { id: zakazkaId, ukolId } })
    expect((await back.json()).text).toBe('Objednat venkovní jednotku')
    expect((await prisma.zakazkaUkol.findUnique({ where: { id: ukolId } }))?.hotovoAt).toBeNull()
  })

  it('GET řadí nehotové před hotové', async () => {
    loginAs(adminId, orgId)
    const hotovy = await prisma.zakazkaUkol.create({ data: { orgId, zakazkaId, text: 'Hotový', hotovo: true, poradi: 0 } })
    const res = await ukolyGet(new Request('http://t/api'), { params: { id: zakazkaId } })
    const list = await res.json()
    expect(list.map((u: { id: string }) => u.id)).toEqual([ukolId, hotovy.id])
    await prisma.zakazkaUkol.delete({ where: { id: hotovy.id } })
  })

  it('DELETE smaže', async () => {
    loginAs(adminId, orgId)
    const res = await ukolDelete(new Request('http://t/api', { method: 'DELETE' }), { params: { id: zakazkaId, ukolId } })
    expect(res.status).toBe(200)
    expect(await prisma.zakazkaUkol.findUnique({ where: { id: ukolId } })).toBeNull()
  })
})

describe('dashboard „Co mám dělat“', () => {
  it('sloučí aktivity OP a úkoly zakázek řešitele do skupin podle termínu', async () => {
    const dnes = new Date(); dnes.setHours(10, 0, 0, 0)
    const vcera = new Date(dnes); vcera.setDate(dnes.getDate() - 1)
    const zaTriDny = new Date(dnes); zaTriDny.setDate(dnes.getDate() + 3)
    const zaMesic = new Date(dnes); zaMesic.setDate(dnes.getDate() + 30)

    await prisma.activity.createMany({
      data: [
        { orgId, dealId, userId: adminId, resitelId: kolegaId, typ: 'HOVOR', popis: 'Zavolat včera', datum: vcera },
        { orgId, dealId, userId: kolegaId, resitelId: null, typ: 'EMAIL', popis: 'Bez řešitele, autor já', datum: dnes },
        { orgId, dealId, userId: adminId, resitelId: adminId, typ: 'HOVOR', popis: 'Cizí řešitel', datum: dnes },
        { orgId, dealId, userId: adminId, resitelId: kolegaId, typ: 'SCHUZKA', popis: 'Hotová', datum: dnes, stav: 'DOKONCENA', splneno: true },
        { orgId, dealId, userId: adminId, resitelId: kolegaId, typ: 'HOVOR', popis: 'Za měsíc', datum: zaMesic },
      ],
    })
    await prisma.zakazkaUkol.createMany({
      data: [
        { orgId, zakazkaId, text: 'Úkol za 3 dny', resitelId: kolegaId, termin: zaTriDny },
        { orgId, zakazkaId, text: 'Úkol bez termínu', resitelId: kolegaId },
        { orgId, zakazkaId, text: 'Úkol kolegy admina', resitelId: adminId },
        { orgId, zakazkaId, text: 'Hotový úkol', resitelId: kolegaId, hotovo: true },
      ],
    })

    loginAs(kolegaId, orgId, 'OBCHODNIK')
    const res = await coMamDelat(new Request('http://t/api'))
    expect(res.status).toBe(200)
    const { polozky } = await res.json()
    const popisky = polozky.map((p: { text: string; skupina: string }) => `${p.skupina}:${p.text}`)
    expect(popisky).toEqual([
      'PO_TERMINU:Zavolat včera',
      'DNES:Bez řešitele, autor já',
      'TYDEN:Úkol za 3 dny',
      'BEZ_TERMINU:Úkol bez termínu',
    ])
    const ukol = polozky.find((p: { druh: string }) => p.druh === 'UKOL')
    expect(ukol.parentId).toBe(zakazkaId)
    expect(ukol.kontext.href).toBe(`/zakazky/${zakazkaId}?tab=ukoly`)
  })
})
