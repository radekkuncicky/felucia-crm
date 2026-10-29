import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { ROLE_PRESETS } from '@/lib/permissions'
import { executeAiTool, nahledAkce, nastrojeProKontext } from '@/lib/ai/tools'
import type { AiKontext } from '@/lib/ai/types'

/**
 * MCP nabídky a klienti: get/update/copy/delete_quote, change_deal_client,
 * update_client, create_client s adresou — izolace firem (i přes položky
 * a produkty), součty jako UI, zámek nabídky, přesun OP se zakázkou.
 */

const RUN = `nabidky-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let mcp: AiKontext
let obchodnik: AiKontext

const ids: Record<string, string> = {}

async function nabidka(orgId: string, dealId: string, kod: string, p: { aktivni?: boolean; stav?: 'ROZPRACOVANA' | 'ODESLANA' | 'AKCEPTOVANA' } = {}) {
  const q = await prisma.quote.create({
    data: {
      orgId, dealId, kod: `${RUN}-${kod}`, nazev: `Nabídka ${kod}`, dphSazba: 12, aktivni: p.aktivni ?? false, stav: p.stav ?? 'ROZPRACOVANA',
      items: {
        create: [
          { dealId, nazev: 'Jednotka', mnozstvi: 2, cenaZaKus: 1000, sleva: 10, poradi: 0 },
          { dealId, nazev: 'Montáž', mnozstvi: 1, cenaZaKus: 500, sleva: 0, poradi: 1 },
          { dealId, nazev: 'Doprava', mnozstvi: 3, cenaZaKus: 100, sleva: 0, poradi: 2, jednotka: 'km' },
        ],
      },
    },
    include: { items: { orderBy: { poradi: 'asc' } } },
  })
  return q
}

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Nabídky A', slug: RUN } })
  orgB = await prisma.organization.create({ data: { nazev: 'Nabídky B', slug: `${RUN}-b` } })
  const uJ = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Jednatel', email: `${RUN}-j@test.cz`, hesloHash: 'x', role: 'JEDNATEL' } })
  const uO = await prisma.user.create({ data: { orgId: orgA.id, jmeno: 'Obchodník', email: `${RUN}-o@test.cz`, hesloHash: 'x', role: 'OBCHODNIK' } })
  mcp = { orgId: orgA.id, userId: uJ.id, role: 'JEDNATEL', jmeno: 'Jednatel', perms: ROLE_PRESETS.JEDNATEL, zdroj: 'mcp' }
  obchodnik = { orgId: orgA.id, userId: uO.id, role: 'OBCHODNIK', jmeno: 'Obchodník', perms: { ...ROLE_PRESETS.OBCHODNIK, obchodCiziOP: false }, zdroj: 'mcp' }

  const machac = await prisma.client.create({ data: { orgId: orgA.id, jmeno: 'Jan', prijmeni: 'Macháč' } })
  const firma = await prisma.client.create({ data: { orgId: orgA.id, typKlienta: 'FIRMA', jmeno: 'Essential Construction s.r.o.', prijmeni: '', email: 'info@essential.cz', ulice: 'Polní 33', mesto: 'Hlučín', psc: '748 01' } })
  const kB = await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Cizí', prijmeni: 'Klient' } })
  Object.assign(ids, { machac: machac.id, firma: firma.id, kB: kB.id })

  const op = (orgId: string, clientId: string, kod: string) =>
    prisma.deal.create({ data: { orgId, clientId, kod: `${RUN}-${kod}`, technologie: 'KLIMA', userId: orgId === orgA.id ? uJ.id : null } })
  const dA = await op(orgA.id, machac.id, 'OP-A')
  const dCil = await op(orgA.id, firma.id, 'OP-CIL')
  const dB = await op(orgB.id, kB.id, 'OP-B')
  const dSod = await op(orgA.id, machac.id, 'OP-SOD')
  const dVyuct = await op(orgA.id, machac.id, 'OP-VYUCT')
  const dPresun = await op(orgA.id, machac.id, 'OP-PRESUN')
  Object.assign(ids, { dA: dA.id, dCil: dCil.id, dB: dB.id, dVyuct: dVyuct.id, dPresun: dPresun.id })

  const qA = await nabidka(orgA.id, dA.id, 'QA')
  const qB = await nabidka(orgB.id, dB.id, 'QB')
  const qAkcept = await nabidka(orgA.id, dA.id, 'QAKCEPT', { stav: 'AKCEPTOVANA', aktivni: true })
  const qSod = await nabidka(orgA.id, dSod.id, 'QSOD', { aktivni: true })
  const qSmaz = await nabidka(orgA.id, dA.id, 'QSMAZ')
  const qOdesl = await nabidka(orgA.id, dA.id, 'QODESL', { stav: 'ODESLANA' })
  Object.assign(ids, { qA: qA.id, qB: qB.id, qBItem: qB.items[0].id, qAItem0: qA.items[0].id, qAItem2: qA.items[2].id, qAkcept: qAkcept.id, qSod: qSod.id, qSmaz: qSmaz.id, qOdesl: qOdesl.id })

  const sodBase = { orgId: orgA.id, typ: 'DPH_12_BEZ_ZALOHY' as const, klientJmeno: 'Jan Macháč', predmetDila: 'Klima' }
  await prisma.sod.create({ data: { ...sodBase, dealId: dSod.id, cislo: `${RUN}-SOD1`, stav: 'ODESLANO' } })
  await prisma.sod.create({ data: { ...sodBase, dealId: dPresun.id, cislo: `${RUN}-SOD2`, stav: 'NAVRH' } })
  await prisma.zakazka.create({ data: { orgId: orgA.id, cislo: `${RUN}-Z1`, klientId: machac.id, opId: dVyuct.id, nazev: 'Vyúčtovaná', stav: 'VYUCTOVANA' } })
  const zP = await prisma.zakazka.create({ data: { orgId: orgA.id, cislo: `${RUN}-Z2`, klientId: machac.id, opId: dPresun.id, nazev: 'Nová', stav: 'NOVA' } })
  ids.zPresun = zP.id

  const pA = await prisma.product.create({ data: { orgId: orgA.id, nazev: 'Cu potrubí', standardniCena: 250, jednotka: 'm' } })
  const pB = await prisma.product.create({ data: { orgId: orgB.id, nazev: 'Cizí produkt', standardniCena: 1 } })
  Object.assign(ids, { pA: pA.id, pB: pB.id })
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.aiAuditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.sod.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.zakazka.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.quoteItem.deleteMany({ where: { deal: { orgId: { in: orgIds } } } })
  await prisma.quote.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.product.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.user.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

const run = async (ctx: AiKontext, name: string, input: Record<string, unknown>) =>
  JSON.parse((await executeAiTool(ctx, name, input, 'POTVRZENO')).result)

const historie = (zaznamId: string) => prisma.auditLog.findMany({ where: { zaznamId }, orderBy: { vytvoreno: 'asc' } })

describe('dostupnost', () => {
  it('nabídky jen v MCP s obchodem, update_client i na webu', () => {
    const jmena = (c: AiKontext) => nastrojeProKontext(c).map(t => t.name)
    expect(jmena(mcp)).toEqual(expect.arrayContaining(['get_quote', 'update_quote', 'copy_quote', 'delete_quote', 'change_deal_client', 'update_client']))
    expect(jmena({ ...mcp, zdroj: 'web' })).not.toContain('copy_quote')
    expect(jmena({ ...mcp, zdroj: 'web' })).toContain('update_client')
    expect(jmena({ ...mcp, perms: ROLE_PRESETS.TECHNIK })).not.toContain('get_quote')
  })
})

describe('cizí firma = nenalezeno u každého nástroje', () => {
  it('get / update / copy / delete nabídky', async () => {
    expect((await run(mcp, 'get_quote', { quoteId: ids.qB })).chyba).toMatch(/nenalezena/)
    expect((await run(mcp, 'get_quote', { quoteId: `${RUN}-QB` })).chyba).toMatch(/nenalezena/)
    expect((await run(mcp, 'update_quote', { quoteId: ids.qB, nazev: 'X' })).chyba).toMatch(/nenalezena/)
    expect((await run(mcp, 'copy_quote', { quoteId: ids.qB, targetDealId: ids.dCil })).chyba).toMatch(/nenalezena/)
    expect((await run(mcp, 'copy_quote', { quoteId: ids.qA, targetDealId: ids.dB })).chyba).toMatch(/nenalezen/)
    expect((await run(mcp, 'delete_quote', { quoteId: ids.qB })).chyba).toMatch(/nenalezena/)
    expect(await prisma.quote.count({ where: { orgId: orgB.id } })).toBe(1)
  })

  it('cizí položka ani cizí produkt v update_quote neprojdou a nic se nezmění', async () => {
    const r1 = await run(mcp, 'update_quote', { quoteId: ids.qA, nazev: 'Nesmí se uložit', update: [{ itemId: ids.qBItem, mnozstvi: 99 }] })
    expect(r1.chyba).toMatch(/v nabídce není/)
    const r2 = await run(mcp, 'update_quote', { quoteId: ids.qA, nazev: 'Nesmí se uložit', add: [{ nazev: 'X', mnozstvi: 1, cenaZaKus: 1, productId: ids.pB }] })
    expect(r2.chyba).toMatch(/nenalezen v katalogu/)
    expect((await prisma.quote.findUnique({ where: { id: ids.qA } }))!.nazev).toBe('Nabídka QA')
    expect(Number((await prisma.quoteItem.findUnique({ where: { id: ids.qBItem } }))!.mnozstvi)).toBe(2)
  })

  it('přesun OP a úprava klienta', async () => {
    expect((await run(mcp, 'change_deal_client', { dealId: ids.dA, clientId: ids.kB })).chyba).toMatch(/Klient nenalezen/)
    expect((await run(mcp, 'change_deal_client', { dealId: ids.dB, clientId: ids.firma })).chyba).toMatch(/OP nenalezen/)
    expect((await run(mcp, 'update_client', { klientId: ids.kB, telefon: '1', potvrdit: true })).chyba).toMatch(/nenalezen/)
  })

  it('obchodník bez cizích OP nevidí nabídku jednatele', async () => {
    expect((await run(obchodnik, 'get_quote', { quoteId: ids.qA })).chyba).toBeTruthy()
  })
})

describe('get_quote', () => {
  it('hlavička, položky a součty jako UI (podle kódu)', async () => {
    const r = await run(mcp, 'get_quote', { quoteId: `${RUN}-QA` })
    // 2×1000 −10 % + 500 + 3×100 = 2600; s 12 % DPH 2912
    expect(r).toMatchObject({ kod: `${RUN}-QA`, op: `${RUN}-OP-A`, klient: 'Jan Macháč', aktivni: false, stav: 'ROZPRACOVANA', dphSazba: 12, celkemBezDph: 2600, celkemSDph: 2912, pocetPolozek: 3 })
    expect(r.polozky[0]).toMatchObject({ nazev: 'Jednotka', mnozstvi: 2, cenaZaKus: 1000, sleva: 10, celkemBezDph: 1800 })
  })
})

describe('copy_quote', () => {
  it('kopie do OP jiného klienta má stejný součet, slevy i pořadí', async () => {
    const r = await run(mcp, 'copy_quote', { quoteId: `${RUN}-QA`, targetDealId: `${RUN}-OP-CIL` })
    expect(r).toMatchObject({ ok: true, op: `${RUN}-OP-CIL`, klient: 'Essential Construction s.r.o.', celkemBezDph: 2600, pocetPolozek: 3, nazev: 'Kopie - Nabídka QA' })
    expect(r.puvodni).toMatchObject({ celkemBezDph: 2600, pocetPolozek: 3 })
    expect(r.kod).toMatch(/^NAB-\d{2}-\d{4}$/)
    const kopie = await prisma.quote.findUnique({ where: { id: r.quoteId }, include: { items: { orderBy: { poradi: 'asc' } } } })
    expect(kopie).toMatchObject({ orgId: orgA.id, dealId: ids.dCil, aktivni: false, dphSazba: 12 })
    expect(kopie!.items.map(i => [i.nazev, Number(i.sleva), i.poradi, i.dealId])).toEqual([
      ['Jednotka', 10, 0, ids.dCil], ['Montáž', 0, 1, ids.dCil], ['Doprava', 0, 2, ids.dCil],
    ])
    expect((await historie(r.quoteId))[0]).toMatchObject({ typAkce: 'CREATE', actorType: 'ai', aiSource: 'mcp' })
  })

  it('akceptovanou nabídku zkopírovat jde', async () => {
    expect((await run(mcp, 'copy_quote', { quoteId: ids.qAkcept, targetDealId: ids.dCil })).ok).toBe(true)
  })
})

describe('update_quote', () => {
  it('změna, přidání a odebrání v jednom kroku přepočítá součty', async () => {
    const r = await run(mcp, 'update_quote', {
      quoteId: ids.qA, nazev: 'Upravená',
      update: [{ itemId: ids.qAItem0, mnozstvi: 3 }],
      add: [{ nazev: 'Cu potrubí', mnozstvi: 4, cenaZaKus: 250, productId: ids.pA }],
      remove: [ids.qAItem2],
    })
    // 3×1000 −10 % = 2700 + 500 + 4×250 = 4200
    expect(r).toMatchObject({ ok: true, puvodniCelkemBezDph: 2600, celkemBezDph: 4200, celkemSDph: 4704, pocetPolozek: 3 })
    const g = await run(mcp, 'get_quote', { quoteId: ids.qA })
    expect(g.nazev).toBe('Upravená')
    expect(g.polozky.at(-1)).toMatchObject({ nazev: 'Cu potrubí', jednotka: 'm', productId: ids.pA, poradi: 3 })
    expect((await historie(ids.qA)).at(-1)).toMatchObject({ typAkce: 'UPDATE', actorType: 'ai', aiSource: 'mcp' })
  })

  it('odeslanou nabídku upravit jde', async () => {
    expect((await run(mcp, 'update_quote', { quoteId: ids.qOdesl, nazev: 'Opravená' })).ok).toBe(true)
  })

  it('zamčenou nabídku upravit nejde', async () => {
    expect((await run(mcp, 'update_quote', { quoteId: ids.qAkcept, nazev: 'X' })).chyba).toMatch(/akceptovaná/)
    expect((await run(mcp, 'update_quote', { quoteId: ids.qSod, nazev: 'X' })).chyba).toMatch(/smlouvy/)
    expect((await prisma.quote.findUnique({ where: { id: ids.qSod } }))!.nazev).toBe('Nabídka QSOD')
  })

  it('neplatné množství odmítne', async () => {
    expect((await run(mcp, 'update_quote', { quoteId: ids.qOdesl, update: [{ itemId: 'x', mnozstvi: 1 }] })).chyba).toBeTruthy()
  })
})

describe('delete_quote', () => {
  it('zamčenou, aktivní ani odeslanou nesmaže', async () => {
    expect((await run(mcp, 'delete_quote', { quoteId: ids.qAkcept })).chyba).toBeTruthy()
    expect((await run(mcp, 'delete_quote', { quoteId: ids.qSod })).chyba).toMatch(/Aktivní/)
    expect((await run(mcp, 'delete_quote', { quoteId: ids.qOdesl })).chyba).toMatch(/odeslaná/)
    expect(await prisma.quote.count({ where: { id: { in: [ids.qAkcept, ids.qSod, ids.qOdesl] } } })).toBe(3)
  })

  it('neaktivní rozpracovanou smaže a zapíše do historie', async () => {
    const r = await run(mcp, 'delete_quote', { quoteId: `${RUN}-QSMAZ` })
    expect(r.ok).toBe(true)
    expect(await prisma.quote.findUnique({ where: { id: ids.qSmaz } })).toBeNull()
    expect((await historie(ids.qSmaz))[0]).toMatchObject({ typAkce: 'DELETE', actorType: 'ai' })
  })
})

describe('change_deal_client', () => {
  it('odmítne OP s vyúčtovanou zakázkou a nic nezmění', async () => {
    const r = await run(mcp, 'change_deal_client', { dealId: ids.dVyuct, clientId: ids.firma })
    expect(r.chyba).toMatch(/nepřesunuto/)
    expect(r.varovani[0]).toMatch(/vyúčtovaná/)
    expect((await prisma.deal.findUnique({ where: { id: ids.dVyuct } }))!.clientId).toBe(ids.machac)
  })

  it('force přesune i vyúčtovanou', async () => {
    const r = await run(mcp, 'change_deal_client', { dealId: ids.dVyuct, clientId: ids.firma, force: true })
    expect(r.ok).toBe(true)
    expect(r.upozorneni.join(' ')).toMatch(/přes varování/)
    expect((await prisma.zakazka.findFirst({ where: { opId: ids.dVyuct } }))!.klientId).toBe(ids.firma)
  })

  it('přesune OP se zakázkou, přepíše návrh SOD a zapíše historii', async () => {
    const r = await run(mcp, 'change_deal_client', { dealId: `${RUN}-OP-PRESUN`, clientId: ids.firma })
    expect(r).toMatchObject({ ok: true, klientPred: 'Jan Macháč', klientNovy: 'Essential Construction s.r.o.', presunuteZakazky: [`${RUN}-Z2`], upraveneSmlouvy: [`${RUN}-SOD2`] })
    expect((await prisma.deal.findUnique({ where: { id: ids.dPresun } }))!.clientId).toBe(ids.firma)
    expect((await prisma.zakazka.findUnique({ where: { id: ids.zPresun } }))!.klientId).toBe(ids.firma)
    expect(await prisma.sod.findFirst({ where: { cislo: `${RUN}-SOD2` } })).toMatchObject({ klientJmeno: 'Essential Construction s.r.o.', klientEmail: 'info@essential.cz', klientAdresa: 'Polní 33, 748 01, Hlučín' })
    expect((await historie(ids.dPresun)).at(-1)).toMatchObject({ typAkce: 'UPDATE', actorType: 'ai', aiSource: 'mcp', zmeny: expect.objectContaining({ klientPred: 'Jan Macháč' }) })
    expect((await historie(ids.zPresun)).at(-1)).toMatchObject({ typZaznamu: 'Zakazka', actorType: 'ai' })
  })

  it('OP se smlouvou u podpisu odmítne', async () => {
    const op = await prisma.deal.findFirst({ where: { kod: `${RUN}-OP-SOD` } })
    expect((await run(mcp, 'change_deal_client', { dealId: op!.id, clientId: ids.firma })).varovani[0]).toMatch(/smlouva/)
  })
})

describe('klienti', () => {
  it('create_client složí adresu jako ARES', async () => {
    const r = await run(mcp, 'create_client', { typKlienta: 'FYZICKA_OSOBA', jmeno: 'Petr', prijmeni: 'Novák', ulice: 'Na Vizině', cislo: '1034/28', obec: 'Ostrava', psc: '71000' })
    expect(await prisma.client.findUnique({ where: { id: r.clientId } })).toMatchObject({ ulice: 'Na Vizině 1034/28', mesto: 'Ostrava', psc: '710 00' })
    const r2 = await run(mcp, 'create_client', { typKlienta: 'FYZICKA_OSOBA', jmeno: 'Eva', prijmeni: 'Malá', castObce: 'Lhotka', cislo: '12', obec: 'Hať' })
    expect(await prisma.client.findUnique({ where: { id: r2.clientId } })).toMatchObject({ ulice: 'Lhotka 12', mesto: 'Hať' })
  })

  it('update_client v MCP nejdřív jen náhled, zápis až s potvrdit', async () => {
    const vstup = { klientId: ids.machac, telefon: '777 111 222', adresa: { ulice: 'Školní', cislo: '2', obec: 'Havířov', psc: '736 01' } }
    const n = await run(mcp, 'update_client', vstup)
    expect(n.nahled).toBe(true)
    expect(n.zmeny).toEqual(expect.arrayContaining([{ pole: 'Telefon', puvodni: null, nove: '777 111 222' }, { pole: 'Ulice', puvodni: null, nove: 'Školní 2' }]))
    expect((await prisma.client.findUnique({ where: { id: ids.machac } }))!.telefon).toBeNull()

    const karta = await nahledAkce(mcp, 'update_client', vstup)
    expect(karta.radky).toContain('Telefon: — → 777 111 222')

    const r = await run(mcp, 'update_client', { ...vstup, potvrdit: true })
    expect(r.ok).toBe(true)
    expect(await prisma.client.findUnique({ where: { id: ids.machac } })).toMatchObject({ telefon: '777 111 222', ulice: 'Školní 2', mesto: 'Havířov', psc: '736 01' })
    expect((await historie(ids.machac)).at(-1)).toMatchObject({ typZaznamu: 'Client', actorType: 'ai', zmeny: expect.objectContaining({ telefon: { z: null, na: '777 111 222' } }) })
  })

  it('částečná změna adresy nesmaže ostatní a na webu zapíše hned (kartu řeší agent)', async () => {
    const r = await run({ ...mcp, zdroj: 'web' }, 'update_client', { klientId: ids.machac, adresa: { psc: '73601' }, email: 'jan@machac.cz' })
    expect(r.ok).toBe(true)
    expect(await prisma.client.findUnique({ where: { id: ids.machac } })).toMatchObject({ ulice: 'Školní 2', email: 'jan@machac.cz' })
    expect((await run(mcp, 'update_client', { klientId: ids.machac, email: 'jan@machac.cz' })).chyba).toMatch(/Žádná změna/)
  })
})
