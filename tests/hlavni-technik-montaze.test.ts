import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/push', () => ({ sendPushToUsers: vi.fn() }))

import { POST as pridatKZakazce, DELETE as odebratZeZakazky } from '@/app/api/zakazky/[id]/technici/route'
import { PATCH as zakazkaPatch } from '@/app/api/zakazky/[id]/route'
import { GET as montazeGet } from '@/app/api/zakazky/montaze/route'
import { getServerSession } from 'next-auth'

const RUN = `hlavni-tech-${Date.now()}`

let orgId: string
let adminId: string
let technikA: string
let technikB: string
let zakazka1: string
let zakazka2: string
let ciziZakazka: string

function loginAs(userId: string, role: string, org = orgId) {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role } } as never)
}
const json = (method: string, body: unknown) => new Request('http://test', { method, body: JSON.stringify(body) })
const hlavni = async (id: string) => (await prisma.zakazka.findUnique({ where: { id } }))?.hlavniTechnikId

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Test hlavní technik', slug: RUN } })
  orgId = org.id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  technikA = (await prisma.user.create({ data: { orgId, jmeno: 'Adam', email: `${RUN}-ta@example.com`, hesloHash: 'x', role: 'TECHNIK' } })).id
  technikB = (await prisma.user.create({ data: { orgId, jmeno: 'Bára', email: `${RUN}-tb@example.com`, hesloHash: 'x', role: 'TECHNIK' } })).id
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })
  zakazka1 = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-1`, nazev: 'Z1', klientId: klient.id, vedouciId: adminId, montazOd: new Date('2026-11-10T00:00:00Z'), montazDo: new Date('2026-11-12T00:00:00Z') },
  })).id
  zakazka2 = (await prisma.zakazka.create({
    data: { orgId, cislo: `${RUN}-2`, nazev: 'Z2', klientId: klient.id, vedouciId: adminId, montazOd: new Date('2026-11-20T00:00:00Z') },
  })).id

  const cizi = await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })
  const ciziKlient = await prisma.client.create({ data: { orgId: cizi.id, jmeno: 'C', prijmeni: 'C' } })
  ciziZakazka = (await prisma.zakazka.create({
    data: { orgId: cizi.id, cislo: `${RUN}-C`, nazev: 'Cizí', klientId: ciziKlient.id, montazOd: new Date('2026-11-11T00:00:00Z') },
  })).id
})

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { slug: { startsWith: RUN } } }).catch(() => {})
})

describe('hlavní technik zakázky', () => {
  it('první přiřazený je hlavní, jde přepnout a po odebrání přejde na dalšího', async () => {
    loginAs(adminId, 'ADMIN')
    await pridatKZakazce(json('POST', { technikId: technikA }), { params: { id: zakazka1 } })
    await pridatKZakazce(json('POST', { technikId: technikB }), { params: { id: zakazka1 } })
    expect(await hlavni(zakazka1)).toBe(technikA)

    const res = await zakazkaPatch(json('PATCH', { hlavniTechnikId: technikB }), { params: { id: zakazka1 } })
    expect(res.status).toBe(200)
    expect(await hlavni(zakazka1)).toBe(technikB)

    await odebratZeZakazky(json('DELETE', { technikId: technikB }), { params: { id: zakazka1 } })
    expect(await hlavni(zakazka1)).toBe(technikA)
  })

  it('hlavním nejde udělat technika, který na zakázce není', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await zakazkaPatch(json('PATCH', { hlavniTechnikId: technikB }), { params: { id: zakazka2 } })
    expect(res.status).toBe(400)
  })
})

describe('GET /api/zakazky/montaze', () => {
  const get = (q: string) => montazeGet(new Request(`http://test/api/zakazky/montaze?${q}`))

  it('vrací montáže překrývající rozsah, s hlavním technikem, bez cizí org a bez vyloučené zakázky', async () => {
    loginAs(adminId, 'ADMIN')
    const res = await get('od=2026-11-12&do=2026-11-20')
    expect(res.status).toBe(200)
    const data = await res.json()
    const ids = data.map((m: { zakazkaId: string }) => m.zakazkaId)
    expect(ids).toEqual([zakazka1, zakazka2])
    expect(ids).not.toContain(ciziZakazka)
    expect(data[0].hlavniTechnik).toEqual({ id: technikA, jmeno: 'Adam' })
    expect(data[0].od).toBe('2026-11-10')
    expect(data[0].do).toBe('2026-11-12')

    const bez = await (await get(`od=2026-11-12&do=2026-11-20&bez=${zakazka1}`)).json()
    expect(bez.map((m: { zakazkaId: string }) => m.zakazkaId)).toEqual([zakazka2])

    const mimo = await (await get('od=2026-11-13&do=2026-11-19')).json()
    expect(mimo).toEqual([])
  })

  it('technik vidí jen své zakázky a neplatný rozsah je 400', async () => {
    loginAs(technikA, 'TECHNIK')
    const data = await (await get('od=2026-11-01&do=2026-11-30')).json()
    expect(data.map((m: { zakazkaId: string }) => m.zakazkaId)).toEqual([zakazka1])
    expect((await get('od=2026-11-30&do=2026-11-01')).status).toBe(400)
    expect((await get('od=2026-01-01&do=2026-12-31')).status).toBe(400)
  })
})
