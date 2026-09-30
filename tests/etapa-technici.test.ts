import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { POST as pridatKEtape } from '@/app/api/zakazky/[id]/etapy/[etapaId]/technici/route'
import { DELETE as odebratZEtapy } from '@/app/api/zakazky/[id]/etapy/[etapaId]/technici/[technikId]/route'
import { POST as pridatKZakazce, DELETE as odebratZeZakazky } from '@/app/api/zakazky/[id]/technici/route'
import { GET as etapyGet } from '@/app/api/zakazky/[id]/etapy/route'
import { getServerSession } from 'next-auth'
import { sendPushToUsers } from '@/lib/push'

const RUN = `etapa-tech-${Date.now()}`

let orgId: string
let adminId: string
let technikA: string
let technikB: string
let zakazkaId: string
let etapa1: string
let etapa2: string
let ciziOrgId: string
let ciziTechnik: string

function loginAs(userId: string, role: string, org = orgId) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role } } as never)
}

function json(method: string, body: unknown) {
  return new Request('http://test', { method, body: JSON.stringify(body) })
}

const naZakazce = async (technikId: string) =>
  !!(await prisma.technikZakazka.findFirst({ where: { zakazkaId, technikId } }))
const naEtape = async (etapaId: string, technikId: string) =>
  !!(await prisma.etapaTechnik.findFirst({ where: { etapaId, technikId } }))

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test Etapa technici', slug: RUN } })
  orgId = org.id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@example.com`, hesloHash: 'x', role: 'ADMIN' },
  })).id
  technikA = (await prisma.user.create({
    data: { orgId, jmeno: 'Adam Technik', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })).id
  technikB = (await prisma.user.create({
    data: { orgId, jmeno: 'Bára Technik', email: `${RUN}-b@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  zakazkaId = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-ZAK-001`, nazev: 'Dvě etapy', klientId: klient.id, vedouciId: adminId },
  })).id
  etapa1 = (await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId, cislo: 1 } })).id
  etapa2 = (await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId, cislo: 2 } })).id

  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí org', slug: `${RUN}-cizi` } })
  ciziOrgId = cizi.id
  ciziTechnik = (await prisma.user.create({
    data: { orgId: ciziOrgId, jmeno: 'Cizí', email: `${RUN}-cizi@example.com`, hesloHash: 'x', role: 'TECHNIK' },
  })).id
})

afterAll(async () => {
  await prisma.etapaTechnik.deleteMany({ where: { orgId } })
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.technikZakazka.deleteMany({ where: { zakazka: { orgId } } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId: { in: [orgId, ciziOrgId] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [orgId, ciziOrgId] } } })
})

describe('technici na etapách', () => {
  it('přiřazení k etapě přidá technika i na zakázku, posune NOVA → PRIRAZENA a pošle push', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await pridatKEtape(json('POST', { technikId: technikA }), { params: { id: zakazkaId, etapaId: etapa1 } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.zakazkaNovyStav).toBe('PRIRAZENA')
    expect(await naEtape(etapa1, technikA)).toBe(true)
    expect(await naZakazce(technikA)).toBe(true)
    expect((await prisma.zakazka.findUniqueOrThrow({ where: { id: zakazkaId } })).stav).toBe('PRIRAZENA')
    expect(sendPushToUsers).toHaveBeenCalledTimes(1)
  })

  it('druhá etapa stejného technika: bez duplicity na zakázce a bez dalšího pushe', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await pridatKEtape(json('POST', { technikId: technikA }), { params: { id: zakazkaId, etapaId: etapa2 } })
    expect(res.status).toBe(201)
    expect((await res.json()).novyNaZakazce).toBe(false)
    expect(await prisma.technikZakazka.count({ where: { zakazkaId, technikId: technikA } })).toBe(1)
    expect(sendPushToUsers).toHaveBeenCalledTimes(1)
    // opakované přiřazení ke stejné etapě je idempotentní
    const znovu = await pridatKEtape(json('POST', { technikId: technikA }), { params: { id: zakazkaId, etapaId: etapa2 } })
    expect(znovu.status).toBe(201)
    expect(await prisma.etapaTechnik.count({ where: { etapaId: etapa2, technikId: technikA } })).toBe(1)
  })

  it('GET etap vrací techniky jako { id, jmeno }', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await etapyGet(new Request('http://test'), { params: { id: zakazkaId } })
    const etapy = await res.json()
    expect(etapy[0].technici).toEqual([{ id: technikA, jmeno: 'Adam Technik' }])
  })

  it('odebrání z etapy nechá technika na zakázce i na druhé etapě', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await odebratZEtapy(new Request('http://test', { method: 'DELETE' }), { params: { id: zakazkaId, etapaId: etapa1, technikId: technikA } })
    expect(res.status).toBe(204)
    expect(await naEtape(etapa1, technikA)).toBe(false)
    expect(await naEtape(etapa2, technikA)).toBe(true)
    expect(await naZakazce(technikA)).toBe(true)
  })

  it('odebrání ze zakázky ho odebere i ze všech etap', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await odebratZeZakazky(json('DELETE', { technikId: technikA }), { params: { id: zakazkaId } })
    expect(res.status).toBe(200)
    expect(await naZakazce(technikA)).toBe(false)
    expect(await prisma.etapaTechnik.count({ where: { technikId: technikA } })).toBe(0)
  })

  it('přiřazení k zakázce je idempotentní (dřív padalo na unique)', async () => {
    loginAs(adminId, 'ADMIN')
    const p = { params: { id: zakazkaId } }
    expect((await pridatKZakazce(json('POST', { technikId: technikB }), p)).status).toBe(201)
    expect((await pridatKZakazce(json('POST', { technikId: technikB }), p)).status).toBe(201)
    expect(await prisma.technikZakazka.count({ where: { zakazkaId, technikId: technikB } })).toBe(1)
  })

  it('technik bez práva editace nepřiřazuje, technik z cizí org neprojde, cizí etapa 404', async () => {
    loginAs(technikB, 'TECHNIK')
    const zakaz = await pridatKEtape(json('POST', { technikId: technikB }), { params: { id: zakazkaId, etapaId: etapa1 } })
    expect(zakaz.status).toBe(403)

    loginAs(adminId, 'ADMIN')
    const cizi = await pridatKEtape(json('POST', { technikId: ciziTechnik }), { params: { id: zakazkaId, etapaId: etapa1 } })
    expect(cizi.status).toBe(400)

    loginAs(ciziTechnik, 'ADMIN', ciziOrgId)
    const jinaOrg = await pridatKEtape(json('POST', { technikId: ciziTechnik }), { params: { id: zakazkaId, etapaId: etapa1 } })
    expect(jinaOrg.status).toBe(404)
  })
})
