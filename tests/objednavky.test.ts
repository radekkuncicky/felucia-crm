import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
vi.mock('@/lib/pdf', () => ({ generatePdf: vi.fn(async (html: string) => Buffer.from(html)) }))

import { GET as dodavateleGet, POST as dodavateleePost } from '@/app/api/dodavatele/route'
import { PATCH as dodavatelPatch, DELETE as dodavatelDelete, GET as dodavatelGet } from '@/app/api/dodavatele/[id]/route'
import { POST as vazbaPost, GET as vazbyGet } from '@/app/api/products/[id]/dodavatele/route'
import { PATCH as vazbaPatch, DELETE as vazbaDelete } from '@/app/api/products/[id]/dodavatele/[dodavatelId]/route'
import { GET as pripravaGet } from '@/app/api/zakazky/[id]/objednavky/priprava/route'
import { POST as objednatPost, GET as zakazkaObjednavkyGet } from '@/app/api/zakazky/[id]/objednavky/route'
import { PATCH as objednavkaPatch, DELETE as objednavkaDelete } from '@/app/api/objednavky/[id]/route'
import { POST as prijemPost } from '@/app/api/objednavky/[id]/prijem/route'
import { GET as pdfGet } from '@/app/api/objednavky/[id]/pdf/route'
import { GET as objednavkyGet } from '@/app/api/objednavky/route'
import { getServerSession } from 'next-auth'
import { stavProduktu } from '@/lib/sklad'
import { formatKcPresne } from '@/lib/format'

const RUN = `obj-${Date.now()}`

let orgId: string
let ciziOrgId: string
let adminId: string
let technikId: string
let ciziAdminId: string
let zakazkaId: string
let productA: string
let productB: string
let polozkaA: string
let polozkaB: string
let polozkaRucni: string
let dodavatelX: string
let dodavatelY: string

function loginAs(userId: string, org: string, role = 'ADMIN') {
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: userId, orgId: org, role, plan: 'PROFESSIONAL' } } as never)
}
const json = (url: string, body: unknown, method = 'POST') => new Request(url, { method, body: JSON.stringify(body) })
const P = (id: string) => ({ params: { id } })

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test Objednávky', slug: RUN, plan: 'PROFESSIONAL' } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: 'Cizí', slug: `${RUN}-cizi` } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-a@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
  technikId = (await prisma.user.create({ data: { orgId, jmeno: 'Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'HLAVNI_TECHNIK' } })).id
  ciziAdminId = (await prisma.user.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí', email: `${RUN}-c@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id

  productA = (await prisma.product.create({ data: { orgId, kod: 'A', nazev: 'Jednotka A', standardniCena: 1000, nakladovaCena: 600, objednaciKod: 'GEN-A' } })).id
  productB = (await prisma.product.create({ data: { orgId, kod: 'B', nazev: 'Potrubí B', standardniCena: 100, nakladovaCena: 50 } })).id

  const klient = await prisma.client.create({ data: { orgId, jmeno: 'K', prijmeni: 'L' } })
  const z = await prisma.zakazka.create({
    data: {
      orgId, cislo: `${RUN}-Z1`, nazev: 'Zakázka', klientId: klient.id, vedouciId: adminId, stav: 'V_REALIZACI', mistoStavby: 'Brno, Hlavní 1',
      polozky: { create: [
        { productId: productA, nazev: 'Jednotka A', mnozstvi: 2, jednotka: 'ks', poradi: 0 },
        { productId: productB, nazev: 'Potrubí B', mnozstvi: 10, jednotka: 'm', poradi: 1 },
        { nazev: 'Ruční položka', mnozstvi: 1, jednotka: 'ks', poradi: 2 },
      ] },
    },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  zakazkaId = z.id
  ;[polozkaA, polozkaB, polozkaRucni] = z.polozky.map(p => p.id)
})

afterAll(async () => {
  for (const org of [orgId, ciziOrgId]) {
    await prisma.notification.deleteMany({ where: { orgId: org } })
    await prisma.auditLog.deleteMany({ where: { orgId: org } })
    await prisma.orgSettings.deleteMany({ where: { orgId: org } })
    await prisma.objednavkaPolozka.deleteMany({ where: { orgId: org } })
    await prisma.objednavka.deleteMany({ where: { orgId: org } })
    await prisma.productDodavatel.deleteMany({ where: { orgId: org } })
    await prisma.dodavatel.deleteMany({ where: { orgId: org } })
    await prisma.skladPohyb.deleteMany({ where: { orgId: org } })
    await prisma.zakazkaPolozka.deleteMany({ where: { zakazka: { orgId: org } } })
    await prisma.zakazka.deleteMany({ where: { orgId: org } })
    await prisma.client.deleteMany({ where: { orgId: org } })
    await prisma.product.deleteMany({ where: { orgId: org } })
    await prisma.user.deleteMany({ where: { orgId: org } })
    await prisma.organization.delete({ where: { id: org } })
  }
})

describe('dodavatelé', () => {
  it('CRUD + tenant izolace', async () => {
    loginAs(adminId, orgId)
    const bad = await dodavateleePost(json('http://t', { nazev: '', email: 'x' }))
    expect(bad.status).toBe(400)
    const x = await (await dodavateleePost(json('http://t', { nazev: 'Dodavatel X', email: 'x@example.com', ico: '123' }))).json()
    dodavatelX = x.id
    dodavatelY = (await (await dodavateleePost(json('http://t', { nazev: 'Dodavatel Y' }))).json()).id

    const list = await (await dodavateleGet(new Request('http://t/api/dodavatele'))).json()
    expect(list.map((d: { nazev: string }) => d.nazev)).toEqual(['Dodavatel X', 'Dodavatel Y'])

    const upd = await dodavatelPatch(json('http://t', { telefon: '777' }, 'PATCH'), P(dodavatelX))
    expect((await upd.json()).telefon).toBe('777')

    loginAs(ciziAdminId, ciziOrgId)
    expect((await dodavatelGet(new Request('http://t'), P(dodavatelX))).status).toBe(404)
    expect(await (await dodavateleGet(new Request('http://t/api/dodavatele'))).json()).toEqual([])
  })

  it('HLAVNI_TECHNIK (sklad CTENI) čte, ale nezakládá', async () => {
    loginAs(technikId, orgId, 'HLAVNI_TECHNIK')
    expect((await dodavateleGet(new Request('http://t/api/dodavatele'))).status).toBe(200)
    expect((await dodavateleePost(json('http://t', { nazev: 'Nesmí' }))).status).toBe(403)
  })
})

describe('vazba produkt ↔ dodavatel', () => {
  it('první vazba je hlavní, přepnutí hlavního shodí ostatní, odebrání hlavního povýší dalšího', async () => {
    loginAs(adminId, orgId)
    const v1 = await (await vazbaPost(json('http://t', { dodavatelId: dodavatelX, objednaciKod: 'X-A1', nakupniCena: 550 }), P(productA))).json()
    expect(v1.hlavni).toBe(true)
    expect(v1.nakupniCena).toBe(550)
    const v2 = await (await vazbaPost(json('http://t', { dodavatelId: dodavatelY, objednaciKod: 'Y-A1', nakupniCena: 580 }), P(productA))).json()
    expect(v2.hlavni).toBe(false)
    expect((await vazbaPost(json('http://t', { dodavatelId: dodavatelX }), P(productA))).status).toBe(409)

    await vazbaPatch(json('http://t', { hlavni: true }, 'PATCH'), { params: { id: productA, dodavatelId: dodavatelY } })
    const list = await (await vazbyGet(new Request('http://t'), P(productA))).json()
    expect(list.find((v: { dodavatelId: string }) => v.dodavatelId === dodavatelY).hlavni).toBe(true)
    expect(list.find((v: { dodavatelId: string }) => v.dodavatelId === dodavatelX).hlavni).toBe(false)
    expect(list.filter((v: { hlavni: boolean }) => v.hlavni)).toHaveLength(1)

    await vazbaDelete(new Request('http://t', { method: 'DELETE' }), { params: { id: productA, dodavatelId: dodavatelY } })
    const po = await (await vazbyGet(new Request('http://t'), P(productA))).json()
    expect(po).toHaveLength(1)
    expect(po[0].dodavatelId).toBe(dodavatelX)
    expect(po[0].hlavni).toBe(true)

    // B dodává Y bez vlastního kódu (fallback na kod produktu)
    await vazbaPost(json('http://t', { dodavatelId: dodavatelY, nakupniCena: 45 }), P(productB))
  })

  it('dodavatel s vazbami, ale bez objednávek, jde smazat (vazby kaskádou)', async () => {
    loginAs(adminId, orgId)
    const tmp = (await (await dodavateleePost(json('http://t', { nazev: 'Dočasný' }))).json()).id
    await vazbaPost(json('http://t', { dodavatelId: tmp }), P(productB))
    const res = await dodavatelDelete(new Request('http://t', { method: 'DELETE' }), P(tmp))
    expect((await res.json()).deaktivovan).toBe(false)
    expect(await prisma.productDodavatel.count({ where: { dodavatelId: tmp } })).toBe(0)
  })
})

describe('objednávka ze zakázky', () => {
  let objX: string
  let objY: string

  it('příprava: hlavní dodavatel předvybraný, ruční položka bez dodavatelů', async () => {
    loginAs(adminId, orgId)
    const d = await (await pripravaGet(new Request('http://t'), P(zakazkaId))).json()
    expect(d.dodavatele).toHaveLength(2)
    const a = d.polozky.find((p: { id: string }) => p.id === polozkaA)
    expect(a.dodavatele[0]).toMatchObject({ dodavatelId: dodavatelX, hlavni: true, objednaciKod: 'X-A1', nakupniCena: 550 })
    const rucni = d.polozky.find((p: { id: string }) => p.id === polozkaRucni)
    expect(rucni.dodavatele).toEqual([])
  })

  it('bez dodavatele u skupiny → 400; 3 položky / 2 dodavatelé → 2 objednávky, položky OBJEDNANO, snapshot kódu a ceny', async () => {
    loginAs(adminId, orgId)
    const bad = await objednatPost(json('http://t', { skupiny: [{ dodavatelId: '', polozky: [{ zakazkaPolozkaId: polozkaRucni, mnozstvi: 1 }] }] }), P(zakazkaId))
    expect(bad.status).toBe(400)

    const res = await objednatPost(json('http://t', {
      skupiny: [
        { dodavatelId: dodavatelX, polozky: [{ zakazkaPolozkaId: polozkaA, mnozstvi: 2 }], zobrazitCeny: true, pozadovanyTermin: '2026-10-01' },
        { dodavatelId: dodavatelY, polozky: [{ zakazkaPolozkaId: polozkaB, mnozstvi: 10 }, { zakazkaPolozkaId: polozkaRucni, mnozstvi: 1 }] },
      ],
    }), P(zakazkaId))
    expect(res.status).toBe(201)
    const objs = await res.json()
    expect(objs).toHaveLength(2)
    expect(objs.map((o: { cislo: string }) => o.cislo)).toEqual([`OBJ-26-001`, `OBJ-26-002`].map(c => c.replace('26', new Date().getFullYear().toString().slice(2))))
    const ox = objs.find((o: { dodavatel: { id: string } }) => o.dodavatel.id === dodavatelX)
    const oy = objs.find((o: { dodavatel: { id: string } }) => o.dodavatel.id === dodavatelY)
    objX = ox.id
    objY = oy.id
    expect(ox.polozky[0]).toMatchObject({ objednaciKod: 'X-A1', nakupniCena: 550, mnozstvi: 2 })
    expect(ox.zobrazitCeny).toBe(true)
    expect(ox.celkem).toBe(1100)
    // B: bez kódu u dodavatele → fallback kod produktu ('B' není objednaciKod, kod položky null → product.objednaciKod null → kod položky)
    expect(oy.polozky.find((p: { nazev: string }) => p.nazev === 'Potrubí B')).toMatchObject({ nakupniCena: 45, mnozstvi: 10 })
    expect(oy.polozky.find((p: { nazev: string }) => p.nazev === 'Ruční položka')).toMatchObject({ productId: null, nakupniCena: null })

    const stavy = await prisma.zakazkaPolozka.findMany({ where: { zakazkaId }, select: { id: true, stav: true } })
    expect(stavy.every(s => s.stav === 'OBJEDNANO')).toBe(true)

    const list = await (await zakazkaObjednavkyGet(new Request('http://t'), P(zakazkaId))).json()
    expect(list).toHaveLength(2)
  })

  it('HLAVNI_TECHNIK nevidí nákupní ceny v objednávce, cizí org objednávku nevidí', async () => {
    loginAs(technikId, orgId, 'HLAVNI_TECHNIK')
    const list = await (await zakazkaObjednavkyGet(new Request('http://t'), P(zakazkaId))).json()
    expect(list.every((o: { celkem: number | null; polozky: { nakupniCena: number | null }[] }) => o.celkem === null && o.polozky.every(p => p.nakupniCena === null))).toBe(true)
    loginAs(ciziAdminId, ciziOrgId)
    expect(await (await objednavkyGet(new Request('http://t/api/objednavky'))).json()).toEqual([])
    expect((await prijemPost(json('http://t', { polozky: [] }), P(objX))).status).toBe(404)
  })

  it('PDF: bez financeNakupky bez cen i při zobrazitCeny; s nimi ceny jsou', async () => {
    loginAs(technikId, orgId, 'HLAVNI_TECHNIK')
    const t = await pdfGet(new Request('http://t'), P(objX))
    expect(t.status).toBe(200)
    expect(t.headers.get('Content-Disposition')).toContain('OBJ-')
    const htmlT = Buffer.from(await t.arrayBuffer()).toString()
    expect(htmlT).toContain('X-A1')
    expect(htmlT).toContain('Brno, Hlavní 1')
    expect(htmlT).not.toContain('Cena / MJ')

    loginAs(adminId, orgId)
    const a = await pdfGet(new Request('http://t'), P(objX))
    const htmlA = Buffer.from(await a.arrayBuffer()).toString()
    expect(htmlA).toContain('Cena / MJ')
    expect(htmlA).toContain(formatKcPresne(1100))
  })

  it('částečný příjem: 4 z 10 → CASTECNE_DORUCENA, naSklade 4, položka zakázky pořád OBJEDNANO; dopřijetí → DORUCENA + rezervace', async () => {
    loginAs(adminId, orgId)
    const oy = await prisma.objednavka.findUnique({ where: { id: objY }, include: { polozky: true } })
    const pB = oy!.polozky.find(p => p.nazev === 'Potrubí B')!
    const pR = oy!.polozky.find(p => p.nazev === 'Ruční položka')!

    const nad = await prijemPost(json('http://t', { polozky: [{ id: pB.id, mnozstvi: 11 }] }), P(objY))
    expect(nad.status).toBe(400)

    const r1 = await prijemPost(json('http://t', { polozky: [{ id: pB.id, mnozstvi: 4 }] }), P(objY))
    expect(r1.status).toBe(200)
    expect((await r1.json()).stav).toBe('CASTECNE_DORUCENA')
    expect(await stavProduktu(orgPrisma(orgId), orgId, productB)).toEqual({ naSklade: 4, rezervovano: 0, dostupne: 4 })
    expect((await prisma.zakazkaPolozka.findUnique({ where: { id: polozkaB } }))?.stav).toBe('OBJEDNANO')

    // částečně doručenou nelze zrušit
    expect((await objednavkaPatch(json('http://t', { stav: 'ZRUSENA' }, 'PATCH'), P(objY))).status).toBe(422)

    const r2 = await prijemPost(json('http://t', { polozky: [{ id: pB.id, mnozstvi: 6 }, { id: pR.id, mnozstvi: 1 }] }), P(objY))
    const body = await r2.json()
    expect(body.stav).toBe('DORUCENA')
    expect(body.doruceno).toBeTruthy()
    expect(await stavProduktu(orgPrisma(orgId), orgId, productB)).toEqual({ naSklade: 10, rezervovano: 10, dostupne: 0 })
    expect((await prisma.zakazkaPolozka.findUnique({ where: { id: polozkaB } }))?.stav).toBe('NASKLADNENO')
    expect((await prisma.zakazkaPolozka.findUnique({ where: { id: polozkaRucni } }))?.stav).toBe('NASKLADNENO')
    const prijmy = await prisma.skladPohyb.findMany({ where: { orgId, typ: 'PRIJEM_SKLAD', productId: productB } })
    expect(prijmy.map(p => Number(p.mnozstvi)).sort()).toEqual([4, 6])
    expect((await prijemPost(json('http://t', { polozky: [{ id: pB.id, mnozstvi: 1 }] }), P(objY))).status).toBe(422)
  })

  it('zrušení návrhu vrací položky na CEKA; smazat lze jen návrh', async () => {
    loginAs(adminId, orgId)
    const odesl = await objednavkaPatch(json('http://t', { stav: 'ODESLANA' }, 'PATCH'), P(objX))
    expect((await odesl.json()).stav).toBe('ODESLANA')
    expect((await objednavkaDelete(new Request('http://t', { method: 'DELETE' }), P(objX))).status).toBe(422)
    const zrus = await objednavkaPatch(json('http://t', { stav: 'ZRUSENA' }, 'PATCH'), P(objX))
    expect((await zrus.json()).stav).toBe('ZRUSENA')
    expect((await prisma.zakazkaPolozka.findUnique({ where: { id: polozkaA } }))?.stav).toBe('CEKA')

    // dodavatel s objednávkou se jen deaktivuje
    const del = await dodavatelDelete(new Request('http://t', { method: 'DELETE' }), P(dodavatelX))
    expect((await del.json()).deaktivovan).toBe(true)
  })
})
