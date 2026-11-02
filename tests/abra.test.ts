import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'
import { abraGet, AbraChyba, type AbraKonfigurace } from '@/lib/abra/flexi'
import { flexiDatum, sparujZakazku, typFaktury, ulozFaktury, zakazkaFaktury } from '@/lib/abra/sync'
import { kpiDetail, kpiPrehled } from '@/lib/kpi'

/** ABRA Flexi — čtení vydaných faktur a KPI 1 (zálohy) + 2 (fakturace) z nich */

const RUN = `abra-${Date.now()}`
const K: AbraKonfigurace = { url: 'https://flexi.test', firma: 'firma_s_r_o_', uzivatel: 'api', heslo: 'tajne', orgSlug: RUN }
// „teď“ pro KPI: 20. 10. 2026 — zářijové věci jsou po rozhodném datu, říjnové ne všechny
const NOW = new Date('2026-10-20T10:00:00Z')

let orgId: string
let zakazkaId: string
let etapovaId: string

/** Flexi záznam faktury jak ho vrací API (stringy, `code:` prefixy) */
function flexi(id: number, o: { typ?: string; zakazka?: string; naPolozce?: string; vyst: string; uhr?: string; celkem: number; dph?: number; zbyva?: number }) {
  return {
    id: String(id), kod: `20026${id}`, typDokl: `code:${o.typ ?? 'FAKTURA CZK'}`, 'firma@showAs': 'NOVAK: Jan Novák',
    zakazka: o.zakazka ? `code:${o.zakazka}` : '',
    datVyst: `${o.vyst}+02:00`, datSplat: '', datUhr: o.uhr ? `${o.uhr}+02:00` : '',
    sumCelkem: String(o.celkem), sumDphCelkem: String(o.dph ?? 0), zbyvaUhradit: String(o.zbyva ?? 0),
    stavUhrK: o.zbyva ? '' : 'stavUhr.uhrazeno',
    polozkyFaktury: [{ zakazka: '' }, ...(o.naPolozce ? [{ zakazka: `code:${o.naPolozce}` }] : [])],
  }
}

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Test ABRA', slug: RUN } })).id
  await prisma.orgSettings.create({ data: { orgId, modulKpi: true } })
  const technik = await prisma.user.create({ data: { orgId, jmeno: 'Technik', email: `${RUN}-t@example.com`, hesloHash: 'x', role: 'TECHNIK' } })
  const klient = await prisma.client.create({ data: { orgId, jmeno: 'Jan', prijmeni: 'Novák' } })
  const op = await prisma.deal.create({ data: { orgId, clientId: klient.id, predmet: 'TČ', kod: `${RUN}-op`, technologie: 'TEPELNE_CERPADLO', stav: 'USPECH' } })
  const op2 = await prisma.deal.create({ data: { orgId, clientId: klient.id, predmet: 'Klima', kod: `${RUN}-op2`, technologie: 'KLIMA', stav: 'USPECH' } })
  zakazkaId = (await prisma.zakazka.create({ data: { orgId, cislo: '26-101', nazev: 'TČ Novák', klientId: klient.id, opId: op.id } })).id
  etapovaId = (await prisma.zakazka.create({ data: { orgId, cislo: '26-102', nazev: 'Klima Novák', klientId: klient.id, opId: op2.id } })).id
  const e1 = await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId: etapovaId, cislo: 1 } })
  const e2 = await prisma.zakazkaEtapa.create({ data: { orgId, zakazkaId: etapovaId, cislo: 2 } })

  // SOD 1: 100 000 s DPH, podpis 1. 9., objednávka materiálu 10. 9. — záloha 70 000 uhrazena 8. 9. → splněno
  await prisma.sod.create({ data: { orgId, dealId: op.id, cislo: `${RUN}-S1`, typ: 'DPH_12_SE_ZALOHOU', klientJmeno: 'Jan Novák', predmetDila: 'TČ', cenaSDph: 100000, stav: 'PODEPSANO', podepsano: new Date('2026-09-01T08:00:00Z') } })
  const dodavatel = await prisma.dodavatel.create({ data: { orgId, nazev: 'Velkoobchod' } })
  await prisma.objednavka.create({ data: { orgId, cislo: `${RUN}-OBJ1`, dodavatelId: dodavatel.id, zakazkaId, vytvorilId: technik.id, stav: 'ODESLANA', odeslano: new Date('2026-09-10T08:00:00Z') } })
  // SOD 2: 50 000, podpis 2. 9., bez objednávky → rozhodné 16. 9.; záloha uhrazena až 20. 9. → nesplněno
  await prisma.sod.create({ data: { orgId, dealId: op2.id, cislo: `${RUN}-S2`, typ: 'DPH_12_SE_ZALOHOU', klientJmeno: 'Jan Novák', predmetDila: 'Klima', cenaSDph: 50000, stav: 'PODEPSANO', podepsano: new Date('2026-09-02T08:00:00Z') } })
  // SOD 3: podepsaná 15. 10. → rozhodné 29. 10. je po NOW → čeká
  await prisma.sod.create({ data: { orgId, dealId: op2.id, cislo: `${RUN}-S3`, typ: 'DPH_12_SE_ZALOHOU', klientJmeno: 'Jan Novák', predmetDila: 'Klima', cenaSDph: 50000, stav: 'PODEPSANO', podepsano: new Date('2026-10-15T08:00:00Z') } })

  // Předání: 26-101 podepsáno 22. 9. večer (SELČ 23. 9. 0:30!) → faktura 25. 9. = 2 dny
  await prisma.predavak.create({ data: { orgId, zakazkaId, cislo: `${RUN}-PP1`, technikId: technik.id, stav: 'PODPISAN', podpisano: new Date('2026-09-22T22:30:00Z') } })
  // 26-102 etapa 1 předána 5. 9. → faktura 26-102-1 6. 9. = 1 den; etapa 2 předána 10. 9. → faktura jen etapy 1 se nepočítá → bez faktury
  await prisma.predavak.create({ data: { orgId, zakazkaId: etapovaId, etapaId: e1.id, cislo: `${RUN}-PP2`, technikId: technik.id, stav: 'PODPISAN', podpisano: new Date('2026-09-05T08:00:00Z') } })
  await prisma.predavak.create({ data: { orgId, zakazkaId: etapovaId, etapaId: e2.id, cislo: `${RUN}-PP3`, technikId: technik.id, stav: 'PODPISAN', podpisano: new Date('2026-09-10T08:00:00Z') } })
})

afterAll(async () => {
  await prisma.abraFaktura.deleteMany({ where: { orgId } })
  await prisma.predavak.deleteMany({ where: { orgId } })
  await prisma.objednavka.deleteMany({ where: { orgId } })
  await prisma.dodavatel.deleteMany({ where: { orgId } })
  await prisma.sod.deleteMany({ where: { orgId } })
  await prisma.zakazkaEtapa.deleteMany({ where: { orgId } })
  await prisma.zakazka.deleteMany({ where: { orgId } })
  await prisma.deal.deleteMany({ where: { orgId } })
  await prisma.client.deleteMany({ where: { orgId } })
  await prisma.kpiNastaveni.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('Flexi klient jen čte', () => {
  it('posílá jen GET, filtr v cestě enkódovaný', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ winstrom: { 'faktura-vydana': [{ id: '1' }] } })))
    vi.stubGlobal('fetch', fetchMock)
    try {
      const r = await abraGet(K, 'faktura-vydana', { filtr: "datVyst >= '2026-01-01'", params: { limit: '0' } })
      expect(r).toEqual([{ id: '1' }])
      const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
      expect(init.method).toBe('GET')
      expect(url).toBe("https://flexi.test/c/firma_s_r_o_/faktura-vydana/(datVyst%20%3E%3D%20'2026-01-01').json?limit=0")
    } finally {
      vi.unstubAllGlobals()
    }
  })
  it('do nepovolené evidence (banka) nepustí', async () => {
    await expect(abraGet(K, 'banka')).rejects.toBeInstanceOf(AbraChyba)
  })
  it('chybu Flexi vrátí jako výjimku', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ winstrom: { success: 'false', message: 'Je potřebná autorizace.' } }), { status: 401 })))
    try {
      await expect(abraGet(K, 'zakazka')).rejects.toThrow('Je potřebná autorizace.')
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('mapování faktur', () => {
  it('typ dokladu', () => {
    expect(typFaktury('code:FAKTURA CZK')).toBe('FAKTURA')
    expect(typFaktury('code:FAKTURA PDP')).toBe('FAKTURA')
    expect(typFaktury('code:ZÁLOHA')).toBe('ZALOHA')
    expect(typFaktury('code:DOBROPIS')).toBe('DOBROPIS')
    expect(typFaktury('code:ZDD')).toBe('JINE')
  })
  it('datum Flexi = pražská půlnoc', () => {
    expect(flexiDatum('2026-10-27+01:00')?.toISOString()).toBe('2026-10-26T23:00:00.000Z')
    expect(flexiDatum('')).toBeNull()
  })
  it('zakázka z hlavičky, jinak z položek', () => {
    expect(zakazkaFaktury({ zakazka: 'code:26-001', polozkyFaktury: [{ zakazka: 'code:26-002' }] })).toBe('26-001')
    expect(zakazkaFaktury({ zakazka: '', polozkyFaktury: [{ zakazka: '' }, { zakazka: 'code:26-002' }] })).toBe('26-002')
    expect(zakazkaFaktury({ zakazka: '', polozkyFaktury: [] })).toBeNull()
  })
  it('koncovka -N = etapa, jen když zakázka s celým číslem neexistuje', () => {
    const m = new Map([['26-047', 'a'], ['26-100-1', 'b']])
    expect(sparujZakazku('26-047', m)).toEqual({ zakazkaId: 'a', etapaCislo: null })
    expect(sparujZakazku('26-047-2', m)).toEqual({ zakazkaId: 'a', etapaCislo: 2 })
    expect(sparujZakazku('26-100-1', m)).toEqual({ zakazkaId: 'b', etapaCislo: null })
    expect(sparujZakazku('25-107', m)).toEqual({ zakazkaId: null, etapaCislo: null })
  })
})

describe('sync + KPI z faktur', () => {
  it('bez faktur z ABRA KPI 1 a 2 nepočítají a na Nástěnce nejsou', async () => {
    const vse = await kpiPrehled(orgId, { now: NOW })
    const zalohy = vse.find(k => k.def.kod === 'ZALOHY')!
    expect(zalohy.pocita).toBe(false)
    expect(zalohy.cekaNa).toBe('napojení ABRA Flexi')
    expect((await kpiPrehled(orgId, { jenAktivni: true, now: NOW })).map(k => k.def.kod)).not.toContain('ZALOHY')
  })

  it('uloží, spáruje a smazané ve Flexi odstraní', async () => {
    const r1 = await ulozFaktury(prisma, orgId, [
      flexi(1, { typ: 'ZÁLOHA', naPolozce: '26-101', vyst: '2026-09-03', uhr: '2026-09-08', celkem: 70000, dph: 7500 }),
      flexi(2, { typ: 'ZÁLOHA', naPolozce: '26-102', vyst: '2026-09-03', uhr: '2026-09-20', celkem: 35000 }),
      flexi(3, { zakazka: '26-101', vyst: '2026-09-25', celkem: 30000, zbyva: 30000 }),
      flexi(4, { naPolozce: '26-102-1', vyst: '2026-09-06', uhr: '2026-09-10', celkem: 20000 }),
      flexi(5, { naPolozce: '25-999', vyst: '2026-01-10', celkem: 1000 }),
      flexi(6, { typ: 'DOBROPIS', naPolozce: '26-101', vyst: '2026-09-26', celkem: -1000 }),
    ])
    expect(r1).toEqual({ celkem: 6, sparovano: 5, smazano: 0 })
    const f1 = await prisma.abraFaktura.findFirstOrThrow({ where: { orgId, abraId: 1 } })
    expect(f1).toMatchObject({ typ: 'ZALOHA', zakazkaId, zakazkaKod: '26-101', odberatel: 'Jan Novák', stavUhrady: 'uhrazeno' })
    expect(Number(f1.celkemBezDph)).toBe(62500)
    expect((await prisma.abraFaktura.findFirstOrThrow({ where: { orgId, abraId: 4 } })).etapaCislo).toBe(1)

    // faktura 5 ve Flexi smazána
    const znovu = await ulozFaktury(prisma, orgId, [1, 2, 3, 4, 6].map(id => flexi(id, { typ: id <= 2 ? 'ZÁLOHA' : id === 6 ? 'DOBROPIS' : 'FAKTURA CZK', naPolozce: id === 4 ? '26-102-1' : id % 2 ? '26-101' : '26-102', vyst: id === 3 ? '2026-09-25' : id === 4 ? '2026-09-06' : '2026-09-03', uhr: id === 1 ? '2026-09-08' : id === 2 ? '2026-09-20' : id === 4 ? '2026-09-10' : undefined, celkem: id === 1 ? 70000 : id === 2 ? 35000 : id === 3 ? 30000 : id === 4 ? 20000 : -1000, dph: id === 1 ? 7500 : 0, zbyva: id === 3 ? 30000 : 0 })))
    expect(znovu.smazano).toBe(1)
    expect(await prisma.abraFaktura.count({ where: { orgId } })).toBe(5)
    // prázdná odpověď nic nesmaže
    expect((await ulozFaktury(prisma, orgId, [])).smazano).toBe(0)
  })

  it('KPI 1: zálohy do rozhodného data, mladší SOD čeká', async () => {
    const k = await kpiDetail(orgId, 'ZALOHY', '2026-09', NOW)
    expect(k.pocita).toBe(true)
    // září: S1 splněno (70 000 ze 100 000 do objednávky 10. 9.), S2 nesplněno (úhrada 20. 9. po 16. 9.)
    expect(k.trend.find(b => b.klic === '2026-09')).toMatchObject({ hodnota: 50, detail: '1 z 2' })
    expect(k.zaznamy.map(z => z.titulek)).toEqual([`${RUN}-S2 · Jan Novák`])
    // záloha 20. 9. je po rozhodném 16. 9., počítá se jen faktura etapy 1 uhrazená 10. 9.
    expect(k.zaznamy[0].hodnota).toBe('40 %')
    // říjen: S3 čeká → bez hodnoty
    expect(k.trend.find(b => b.klic === '2026-10')).toMatchObject({ hodnota: null, detail: '0 z 0, 1 čeká' })
  })

  it('KPI 2: dny do faktury po pražských dnech, etapy zvlášť', async () => {
    const k = await kpiDetail(orgId, 'FAKTURACE', '2026-09', NOW)
    const dny = Object.fromEntries(k.zaznamy.map(z => [z.popis!.split(' · ')[0], z.hodnota]))
    expect(dny).toEqual({
      [`${RUN}-PP1`]: '2 d', // předáno 23. 9. (Praha), faktura 25. 9.
      [`${RUN}-PP2`]: '1 d', // etapa 1 → faktura 26-102-1 6. 9.
      [`${RUN}-PP3`]: '40 d', // etapa 2 bez faktury → 10. 9. až 20. 10.
    })
    // nevyfakturované nahoře
    expect(k.zaznamy[0].popis).toContain('bez faktury')
    expect(k.trend.find(b => b.klic === '2026-09')).toMatchObject({ hodnota: Math.round((43 / 3) * 10) / 10, detail: '3 předání, 1 bez faktury' })
  })
})
