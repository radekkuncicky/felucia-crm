import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as diktatPost } from '@/app/api/diktat/route'
import { PATCH as diktatPatch } from '@/app/api/diktat/[id]/route'
import { GET as ukolyGet } from '@/app/api/dashboard/ukoly/route'
import { executeDasaTool, type DasaUser } from '@/lib/dasaTools'
import { zitraPraha } from '@/lib/diktat'

/** Diktát → úkol na zítřek → Dáša založí lead / připojí k OP (procesní mapa C2) */

const RUN = `diktat-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let technikId: string
let dealId: string
let dasa: DasaUser

function loginAs(userId: string, role = 'ADMIN', org = orgId) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role, plan: 'STANDARD' } } as never)
}
const post = (body: unknown) => diktatPost(new Request('http://test', { method: 'POST', body: JSON.stringify(body) }))
const patch = (id: string, body: unknown) => diktatPatch(new Request('http://test', { method: 'PATCH', body: JSON.stringify(body) }), { params: { id } })
const tool = async (name: string, input: Record<string, unknown>, u = dasa) => JSON.parse((await executeDasaTool(name, input, u)).result)

async function novyDiktat(text = 'Volal pan Nový z Opavy, 731 555 666, chce klimatizaci do ložnice.') {
  loginAs(adminId)
  const res = await post({ text })
  expect(res.status).toBe(201)
  return (await res.json()).id as string
}

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test diktát', slug: RUN, plan: 'STANDARD' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })).id
  await prisma.orgSettings.create({ data: { orgId, modulKpi: true } })
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  technikId = (await prisma.user.create({ data: { orgId, jmeno: 'Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Stávající', telefon: '777 111 222' } })
  dealId = (await prisma.deal.create({ data: { orgId, clientId: klient.id, userId: adminId, kod: `${RUN}-OP`, predmet: 'TČ', technologie: 'TEPELNE_CERPADLO' } })).id
  dasa = { id: adminId, orgId, role: 'ADMIN', jmeno: 'Admin', perms: ROLE_PRESETS.ADMIN }
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.activity.deleteMany({ where: { orgId: org } })
    await prisma.lead.deleteMany({ where: { orgId: org } })
    await prisma.deal.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.zdrojPoptavky.deleteMany({ where: { orgId: org } })
    await prisma.orgSettings.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } }).catch(() => {})
  }
})

describe('diktát jako úkol', () => {
  it('uloží se jako úkol bez rodiče na zítřek a je v Co mám dělat s odkazem na diktát', async () => {
    const id = await novyDiktat()
    const a = await prisma.activity.findUniqueOrThrow({ where: { id } })
    expect(a).toMatchObject({ typ: 'UKOL', stav: 'PLANOVANA', dealId: null, leadId: null, resitelId: adminId })
    expect(a.datum.toISOString().slice(0, 10)).toBe(zitraPraha())

    const { polozky } = await (await ukolyGet(new Request('http://test'))).json()
    const p = polozky.find((x: { id: string }) => x.id === id)
    expect(p).toMatchObject({ diktat: true, kontext: { label: 'Diktát', href: `/diktat/${id}` } })
  })

  it('prázdný diktát, špatné datum a technik bez obchodu neprojdou', async () => {
    loginAs(adminId)
    expect((await post({ text: '   ' })).status).toBe(400)
    expect((await post({ text: 'x', datum: 'zítra' })).status).toBe(400)
    loginAs(technikId, 'TECHNIK')
    expect((await post({ text: 'x' })).status).toBe(403)
  })

  it('úprava textu a termínu; cizí org diktát nevidí', async () => {
    const id = await novyDiktat()
    expect((await patch(id, { text: 'Opraveno', datum: '2026-12-01' })).status).toBe(200)
    const a = await prisma.activity.findUniqueOrThrow({ where: { id } })
    expect(a.popis).toBe('Opraveno')
    expect(a.datum.toISOString().slice(0, 10)).toBe('2026-12-01')
    loginAs(adminId, 'ADMIN', ciziOrgId)
    expect((await patch(id, { text: 'cizí' })).status).toBe(404)
  })

  it('DB dovolí aktivitu bez rodiče, ale ne se dvěma rodiči', async () => {
    const lead = await prisma.lead.create({ data: { orgId, jmeno: 'X' } })
    await expect(prisma.activity.create({ data: { orgId, dealId, leadId: lead.id, typ: 'HOVOR', datum: new Date() } })).rejects.toThrow()
    await prisma.lead.delete({ where: { id: lead.id } })
  })
})

describe('Dáša zpracuje diktát', () => {
  it('nový zákazník: s modulem KPI chce zdroj, pak založí lead a diktát připojí jako hovor', async () => {
    const id = await novyDiktat()
    expect(await tool('get_diktat', { diktatId: id })).toMatchObject({ diktatId: id, text: expect.stringContaining('731 555 666') })
    expect(await tool('find_by_phone', { telefon: '731555666' })).toEqual({ zprava: 'Číslo v CRM není' })

    expect((await tool('create_lead', { jmeno: 'Pan Nový', telefon: '731 555 666' })).chyba).toMatch(/zdroj/i)
    const { povinnyULeadu, zdroje } = await tool('list_zdroje_poptavky', {})
    expect(povinnyULeadu).toBe(true)
    const doporuceni = zdroje.find((z: { nazev: string }) => z.nazev === 'Doporučení')

    const lead = await tool('create_lead', { jmeno: 'Pan Nový', telefon: '731 555 666', zprava: 'Klimatizace do ložnice', zdrojPoptavkyId: doporuceni.id })
    expect(lead.ok).toBe(true)
    expect(await tool('pripojit_diktat', { diktatId: id, leadId: lead.leadId })).toEqual({ ok: true })

    const a = await prisma.activity.findUniqueOrThrow({ where: { id } })
    expect(a).toMatchObject({ leadId: lead.leadId, dealId: null, typ: 'HOVOR', stav: 'DOKONCENA' })
    expect(a.datum.getTime()).toBe(a.vytvoreno.getTime())
    expect(await prisma.lead.findUniqueOrThrow({ where: { id: lead.leadId } })).toMatchObject({ status: 'KONTAKTOVAN', assignedToId: adminId })

    // zpracovaný diktát už nejde znovu připojit ani načíst
    expect((await tool('pripojit_diktat', { diktatId: id, dealId })).chyba).toBeTruthy()
    expect((await tool('get_diktat', { diktatId: id })).chyba).toBeTruthy()
  })

  it('stávající klient: najde OP podle čísla a diktát připojí k OP', async () => {
    const id = await novyDiktat('Volal Karel Stávající 777111222, posunout montáž TČ.')
    const shody = await tool('find_by_phone', { telefon: '777111222' })
    expect(shody.klienti[0].otevreneOp.map((o: { id: string }) => o.id)).toEqual([dealId])
    expect(await tool('pripojit_diktat', { diktatId: id, dealId })).toEqual({ ok: true })
    expect(await prisma.activity.findUniqueOrThrow({ where: { id } })).toMatchObject({ dealId, typ: 'HOVOR', stav: 'DOKONCENA' })
  })

  it('připojení chce právě jednoho rodiče; technik diktáty nezpracuje', async () => {
    const id = await novyDiktat()
    expect((await tool('pripojit_diktat', { diktatId: id })).chyba).toBeTruthy()
    const technik = { ...dasa, id: technikId, role: 'TECHNIK', perms: ROLE_PRESETS.TECHNIK }
    expect((await tool('get_diktat', { diktatId: id }, technik)).chyba).toBeTruthy()
    expect((await tool('pripojit_diktat', { diktatId: id, dealId }, technik)).chyba).toBeTruthy()
  })
})
