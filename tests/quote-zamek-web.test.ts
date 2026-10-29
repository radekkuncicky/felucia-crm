import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { PATCH as quotePatch, DELETE as quoteDelete } from '@/app/api/deals/[id]/quotes/[quoteId]/route'
import { POST as itemsPost } from '@/app/api/deals/[id]/quotes/[quoteId]/items/route'
import { PATCH as itemPatch, DELETE as itemDelete } from '@/app/api/deals/[id]/quotes/[quoteId]/items/[itemId]/route'
import { PUT as reorderPut } from '@/app/api/deals/[id]/quotes/[quoteId]/items/reorder/route'
import { zamekNabidky } from '@/lib/quoteZamek'
import { getServerSession } from 'next-auth'

/**
 * Zámek nabídky ve webovém API: akceptovanou nabídku a aktivní nabídku OP
 * se zakázkou nejde obsahově měnit ani smazat (409); aktivace a vzhled PDF jdou.
 */

const RUN = `quote-zamek-${Date.now()}`

let orgId: string
let userId: string
const ids: Record<string, string> = {}

function req(method: string, body?: Record<string, unknown>) {
  return new Request('http://localhost/x', {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
}

async function nabidka(dealId: string, kod: string, p: { aktivni?: boolean; stav?: 'ROZPRACOVANA' | 'AKCEPTOVANA' } = {}) {
  return prisma.quote.create({
    data: {
      orgId, dealId, kod: `${RUN}-${kod}`, nazev: kod, aktivni: p.aktivni ?? false, stav: p.stav ?? 'ROZPRACOVANA',
      items: { create: [{ dealId, nazev: 'Položka', mnozstvi: 1, cenaZaKus: 1000 }] },
    },
    include: { items: true },
  })
}

beforeAll(async () => {
  const org = await prisma.organization.create({ data: { nazev: 'Zámek nabídek', slug: RUN, plan: 'STANDARD' } })
  orgId = org.id
  const user = await prisma.user.create({ data: { orgId, jmeno: 'Adam Admin', email: `${RUN}@example.com`, role: 'ADMIN', hesloHash: 'x' } })
  userId = user.id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId, role: 'ADMIN' } } as never)
  const client = await prisma.client.create({ data: { orgId, jmeno: 'Karel', prijmeni: 'Klient' } })

  const d1 = await prisma.deal.create({ data: { orgId, clientId: client.id, kod: `${RUN}-OP1`, technologie: 'KLIMA', userId } })
  const akcept = await nabidka(d1.id, 'AKCEPT', { aktivni: true, stav: 'AKCEPTOVANA' })
  const volna = await nabidka(d1.id, 'VOLNA')
  const d2 = await prisma.deal.create({ data: { orgId, clientId: client.id, kod: `${RUN}-OP2`, technologie: 'KLIMA', userId } })
  const zak = await nabidka(d2.id, 'ZAK', { aktivni: true })
  const zakDruha = await nabidka(d2.id, 'ZAK2')
  await prisma.zakazka.create({ data: { orgId, cislo: `${RUN}-Z`, klientId: client.id, opId: d2.id, nazev: 'Zakázka' } })
  Object.assign(ids, {
    d1: d1.id, d2: d2.id, akcept: akcept.id, akceptItem: akcept.items[0].id, volna: volna.id, volnaItem: volna.items[0].id,
    zak: zak.id, zakDruha: zakDruha.id,
  })
})

afterAll(async () => {
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId } } })
  await prisma.quote.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
  await prisma.$disconnect()
})

const q = (dealId: string, quoteId: string) => ({ params: { id: dealId, quoteId } })
const it2 = (dealId: string, quoteId: string, itemId: string) => ({ params: { id: dealId, quoteId, itemId } })

describe('zamekNabidky (sdílí API i editor)', () => {
  it('akceptovaná vždy, aktivní jen s podkladem, neaktivní nikdy', () => {
    const zak = { typ: 'zakazka' as const, cislo: 'Z1' }
    expect(zamekNabidky({ aktivni: false, stav: 'AKCEPTOVANA' }, null)).toMatch(/akceptovaná/)
    expect(zamekNabidky({ aktivni: true, stav: 'ODESLANA' }, zak)).toMatch(/zakázky Z1/)
    expect(zamekNabidky({ aktivni: true, stav: 'ODESLANA' }, null)).toBeNull()
    expect(zamekNabidky({ aktivni: false, stav: 'ROZPRACOVANA' }, zak)).toBeNull()
  })
})

describe('akceptovaná nabídka', () => {
  it('položky: přidat, upravit, smazat, přeřadit → 409 a nic se nezmění', async () => {
    const add = await itemsPost(req('POST', { nazev: 'Nová', mnozstvi: 1, cenaZaKus: 1 }), q(ids.d1, ids.akcept))
    expect(add.status).toBe(409)
    expect((await add.json()).error).toMatch(/akceptovaná/)
    expect((await itemPatch(req('PATCH', { nazev: 'X', mnozstvi: 5, cenaZaKus: 1 }), it2(ids.d1, ids.akcept, ids.akceptItem))).status).toBe(409)
    expect((await itemDelete(req('DELETE'), it2(ids.d1, ids.akcept, ids.akceptItem))).status).toBe(409)
    expect((await reorderPut(req('PUT', { items: [{ id: ids.akceptItem, poradi: 9 }] }), q(ids.d1, ids.akcept))).status).toBe(409)
    const item = await prisma.quoteItem.findUnique({ where: { id: ids.akceptItem } })
    expect(item).toMatchObject({ nazev: 'Položka', poradi: 0 })
    expect(Number(item!.mnozstvi)).toBe(1)
    expect(await prisma.quoteItem.count({ where: { quoteId: ids.akcept } })).toBe(1)
  })

  it('název a DPH → 409; nezměněný popis a vzhled PDF projdou', async () => {
    expect((await quotePatch(req('PATCH', { nazev: 'Jiný' }), q(ids.d1, ids.akcept))).status).toBe(409)
    expect((await quotePatch(req('PATCH', { dphSazba: 21 }), q(ids.d1, ids.akcept))).status).toBe(409)
    expect((await quotePatch(req('PATCH', { popis: '', templateId: null }), q(ids.d1, ids.akcept))).status).toBe(200)
  })

  it('smazat nejde', async () => {
    expect((await quoteDelete(req('DELETE'), q(ids.d1, ids.akcept))).status).toBe(409)
    expect(await prisma.quote.findUnique({ where: { id: ids.akcept } })).not.toBeNull()
  })

  it('neaktivní rozpracovaná nabídka téhož OP jde upravit', async () => {
    expect((await itemsPost(req('POST', { nazev: 'Nová', mnozstvi: 1, cenaZaKus: 1 }), q(ids.d1, ids.volna))).status).toBe(201)
    expect((await itemPatch(req('PATCH', { nazev: 'Upravená', mnozstvi: 2, cenaZaKus: 1000 }), it2(ids.d1, ids.volna, ids.volnaItem))).status).toBe(200)
    expect((await quotePatch(req('PATCH', { nazev: 'Přejmenovaná' }), q(ids.d1, ids.volna))).status).toBe(200)
  })
})

describe('aktivní nabídka OP se zakázkou', () => {
  it('obsah zamčený, neaktivní varianta volná', async () => {
    const r = await quotePatch(req('PATCH', { nazev: 'Jiný' }), q(ids.d2, ids.zak))
    expect(r.status).toBe(409)
    expect((await r.json()).error).toMatch(/zakázky/)
    expect((await quoteDelete(req('DELETE'), q(ids.d2, ids.zak))).status).toBe(409)
    expect((await quotePatch(req('PATCH', { nazev: 'Varianta B' }), q(ids.d2, ids.zakDruha))).status).toBe(200)
  })

  it('aktivaci jiné nabídky web nezamyká a OP má pak právě jednu aktivní', async () => {
    expect((await quotePatch(req('PATCH', { aktivni: true }), q(ids.d2, ids.zakDruha))).status).toBe(200)
    const aktivni = await prisma.quote.findMany({ where: { dealId: ids.d2, aktivni: true }, select: { id: true } })
    expect(aktivni.map(x => x.id)).toEqual([ids.zakDruha])
    // původní aktivní je teď neaktivní → zámek ji už nedrží
    expect((await quotePatch(req('PATCH', { nazev: 'Stará verze' }), q(ids.d2, ids.zak))).status).toBe(200)
  })
})
