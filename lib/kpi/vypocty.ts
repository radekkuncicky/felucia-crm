/**
 * Výpočty KPI dostupných ve fázi 1. Každé KPI vrací trend po měsících a
 * záznamy, které ho kazí (proklik). Vše přes orgPrisma + explicitní orgId.
 * Objemy jsou malé (stovky řádků za rok), agreguje se v JS — bez raw SQL
 * nemusí řešit RLS kontext ani časová pásma v SQL.
 */
import type { OrgPrismaClient } from '../orgPrisma'
import type { KpiKod } from './registry'
import { formatCislo, formatKc } from '../format'
import { quoteCelkemBezDph } from '../quoteMath'
import { HISTORIE_OD, datumPraha, mesicKlic, mesicRozsah, prahaDen } from './obdobi'

export interface KpiBod {
  /** Měsíc „YYYY-MM“ */
  klic: string
  hodnota: number | null
  /** Doplňující text k bodu (např. „3 z 12“) */
  detail?: string
}

export interface KpiZaznam {
  id: string
  titulek: string
  popis?: string
  hodnota?: string
  href: string
}

/** Tabulka rozpadu hodnoty za měsíc (např. KPI 6 podle zdroje poptávky) */
export interface KpiRozpad {
  nadpis: string
  sloupce: string[]
  radky: { klic: string; nazev: string; hodnoty: string[] }[]
  poznamka?: string
}

export interface KpiPocitadlo {
  /** `now` = okamžik výpočtu (KPI z faktur hodnotí jen to, co už má být vyřízené) */
  trend(db: OrgPrismaClient, orgId: string, mesice: string[], now?: Date): Promise<KpiBod[]>
  zaznamy(db: OrgPrismaClient, orgId: string, mesic: string, now?: Date): Promise<KpiZaznam[]>
  rozpad?(db: OrgPrismaClient, orgId: string, mesic: string): Promise<KpiRozpad>
  /** Nadpis seznamu záznamů v detailu */
  zaznamyNadpis: string
  /** Poznámka k hodnotě (omezení dat ve fázi 1) */
  poznamka?: string
}

function rozsahMesicu(mesice: string[]) {
  return { od: mesicRozsah(mesice[0] ?? HISTORIE_OD).od, do: mesicRozsah(mesice[mesice.length - 1] ?? HISTORIE_OD).do }
}

function seskup<T>(rows: T[], datum: (r: T) => Date | null, mesice: string[]) {
  const map = new Map<string, T[]>(mesice.map(m => [m, []]))
  for (const r of rows) {
    const d = datum(r)
    if (!d) continue
    map.get(mesicKlic(d))?.push(r)
  }
  return map
}


const LEAD_STATUS: Record<string, string> = {
  NOVY: 'Nový', KONTAKTOVAN: 'Kontaktován', KVALIFIKOVAN: 'Kvalifikován', PREVEDEN: 'Převeden na OP', ZRUSEN: 'Zrušen',
}
const DEAL_STAV: Record<string, string> = {
  NOVY: 'nový', JEDNANI: 'jednání', NABIDKA: 'nabídka', PRED_UZAVRENIM: 'před uzavřením',
  USPECH: 'vyhráno', PAS: 'prohráno', ZNEPLATNENO: 'zneplatněno',
}

const BEZ_ZDROJE = 'Neuvedeno'
const procento = (a: number, b: number) => (b ? `${formatCislo(Math.round((a / b) * 1000) / 10)} %` : '—')

/** Hodnota OP bez DPH z aktivní nabídky (fallback staré položky bez nabídky) — jako seznam OP */
function hodnotaOp(d: { quotes: { items: Polozka[] }[]; quoteItems: Polozka[] }) {
  return quoteCelkemBezDph(d.quotes[0]?.items ?? d.quoteItems)
}
type Polozka = { mnozstvi: unknown; cenaZaKus: unknown; sleva: unknown }
const POLOZKY = { select: { mnozstvi: true, cenaZaKus: true, sleva: true } } as const

/** KPI 6 — vyhrané OP / leady podle měsíce vzniku leadu (R12) */
const konverze: KpiPocitadlo = {
  zaznamyNadpis: 'Leady měsíce, které nevedly k vyhranému případu',
  poznamka: 'Poslední měsíce se ještě dopočítávají — od poptávky k podpisu trvá týdny. Zdroj poptávky se eviduje od října 2026.',
  /**
   * Podle zdroje: konverze leadů vzniklých v měsíci (zdroj leadu) a vyhrané OP
   * podle měsíce výhry (zdroj OP, Q18) — většina OP vzniká bez leadu.
   */
  async rozpad(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const [zdroje, leady, vyhrane] = await Promise.all([
      db.zdrojPoptavky.findMany({ where: { orgId }, select: { id: true, nazev: true }, orderBy: { poradi: 'asc' } }),
      db.lead.findMany({
        where: { orgId, vytvoreno: { gte: od, lt: doD } },
        select: { zdrojPoptavkyId: true, prevedenNaOp: { select: { stav: true } } },
      }),
      db.deal.findMany({
        where: { orgId, stav: 'USPECH', vyhrano: { gte: od, lt: doD } },
        select: {
          zdrojPoptavkyId: true,
          quotes: { where: { aktivni: true }, select: { items: POLOZKY } },
          quoteItems: { where: { quoteId: null }, ...POLOZKY },
        },
      }),
    ])
    const radky = [...zdroje.map(z => ({ klic: z.id, nazev: z.nazev })), { klic: '', nazev: BEZ_ZDROJE }].map(z => {
      const l = leady.filter(x => (x.zdrojPoptavkyId ?? '') === z.klic)
      const lVyhrano = l.filter(x => x.prevedenNaOp?.stav === 'USPECH').length
      const op = vyhrane.filter(x => (x.zdrojPoptavkyId ?? '') === z.klic)
      return {
        ...z,
        pocty: [l.length, op.length],
        hodnoty: [
          String(l.length), String(lVyhrano), procento(lVyhrano, l.length),
          String(op.length), formatKc(op.reduce((s, d) => s + hodnotaOp(d), 0)),
        ],
      }
    })
    return {
      nadpis: 'Podle zdroje poptávky',
      sloupce: ['Leady', 'Z nich vyhráno', 'Konverze', 'Vyhrané OP v měsíci', 'Hodnota bez DPH'],
      // Prázdné zdroje skrýt, „Neuvedeno“ ukázat vždy (ukazuje mezeru v evidenci)
      radky: radky.filter(r => r.klic === '' || r.pocty.some(Boolean)).map(({ klic, nazev, hodnoty }) => ({ klic, nazev, hodnoty })),
      poznamka: 'Leady podle měsíce vzniku a zdroje leadu, vyhrané OP podle data výhry a zdroje OP (hodnota z aktivní nabídky).',
    }
  },
  async trend(db, orgId, mesice) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const leady = await db.lead.findMany({
      where: { orgId, vytvoreno: { gte: od, lt: doD } },
      select: { vytvoreno: true, prevedenNaOp: { select: { stav: true } } },
    })
    const map = seskup(leady, l => l.vytvoreno, mesice)
    return mesice.map(klic => {
      const rows = map.get(klic) ?? []
      const vyhrano = rows.filter(l => l.prevedenNaOp?.stav === 'USPECH').length
      return {
        klic,
        hodnota: rows.length ? Math.round((vyhrano / rows.length) * 1000) / 10 : null,
        detail: `${vyhrano} z ${rows.length}`,
      }
    })
  },
  async zaznamy(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const leady = await db.lead.findMany({
      where: { orgId, vytvoreno: { gte: od, lt: doD }, NOT: { prevedenNaOp: { stav: 'USPECH' } } },
      select: {
        id: true, jmeno: true, firma: true, status: true, sluzba: true,
        prevedenNaOp: { select: { stav: true } }, zdrojPoptavky: { select: { nazev: true } },
      },
      orderBy: { vytvoreno: 'asc' },
    })
    return leady.map(l => ({
      id: l.id,
      titulek: l.firma ? `${l.jmeno} (${l.firma})` : l.jmeno,
      popis: [LEAD_STATUS[l.status] ?? l.status, l.prevedenNaOp ? `OP: ${DEAL_STAV[l.prevedenNaOp.stav] ?? l.prevedenNaOp.stav}` : null, l.zdrojPoptavky?.nazev, l.sluzba]
        .filter(Boolean).join(' · '),
      href: `/leady/${l.id}`,
    }))
  },
}

/** KPI 5 — výdeje bez zakázky mimo provozní spotřebu (R10), fáze 1 jen v Kč */
const materialBezZakazky: KpiPocitadlo = {
  zaznamyNadpis: 'Výdeje ze skladu bez zakázky (mimo provozní spotřebu)',
  poznamka: 'Zatím v Kč z výdejů ve skladu CRM. Procento z tržeb a nákupní faktury z ABRA přijdou s evidencí faktur.',
  async trend(db, orgId, mesice) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const rows = await db.skladPohyb.findMany({
      where: vydejBezZakazky(orgId, od, doD),
      select: { vytvoreno: true, mnozstvi: true, nakupniCena: true },
    })
    const map = seskup(rows, r => r.vytvoreno, mesice)
    return mesice.map(klic => {
      const r = map.get(klic) ?? []
      const suma = r.reduce((s, p) => s + Number(p.mnozstvi) * Number(p.nakupniCena ?? 0), 0)
      return { klic, hodnota: Math.round(suma), detail: `${r.length} výdejů` }
    })
  },
  async zaznamy(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = await db.skladPohyb.findMany({
      where: vydejBezZakazky(orgId, od, doD),
      select: { id: true, nazev: true, mnozstvi: true, nakupniCena: true, duvod: true, vytvoreno: true, vytvoril: { select: { jmeno: true } } },
      orderBy: { vytvoreno: 'asc' },
    })
    return rows.map(p => ({
      id: p.id,
      titulek: p.nazev,
      popis: [`${Number(p.mnozstvi)} ks`, p.duvod, p.vytvoril?.jmeno, datumPraha(p.vytvoreno)]
        .filter(Boolean).join(' · '),
      hodnota: formatKc(Number(p.mnozstvi) * Number(p.nakupniCena ?? 0)),
      href: '/sklad?tab=pohyby',
    }))
  },
}

function vydejBezZakazky(orgId: string, od: Date, doD: Date) {
  return {
    orgId,
    typ: 'VYDEJ' as const,
    zakazkaId: null,
    vytvoreno: { gte: od, lt: doD },
    OR: [{ kategorie: null }, { kategorie: { not: 'PROVOZNI_SPOTREBA' as const } }],
  }
}

/**
 * KPI 8 — dokončené = podepsaný předávací protokol v měsíci (R13, etapa = dokončení R25).
 * Parta = ★ hlavní technik etapy, jinak zakázky (rozhodnutí 2026-10-27: bez samostatné
 * evidence part — hlavní technik se nastavuje sám prvním přiřazeným).
 */
const BEZ_PARTY = 'Bez hlavního technika'
const PREDAVAK_PARTA = {
  etapa: { select: { cislo: true, hlavniTechnik: { select: { id: true, jmeno: true } } } },
  zakazka: { select: { cislo: true, nazev: true, hlavniTechnik: { select: { id: true, jmeno: true } }, klient: { select: { jmeno: true, prijmeni: true } } } },
} as const
type PredavakParta = { etapa: { hlavniTechnik: { id: string; jmeno: string } | null } | null; zakazka: { hlavniTechnik: { id: string; jmeno: string } | null } }
const partaPredavaku = (p: PredavakParta) => p.etapa?.hlavniTechnik ?? p.zakazka.hlavniTechnik

const party: KpiPocitadlo = {
  zaznamyNadpis: 'Předávací protokoly podepsané v měsíci',
  poznamka: 'Parta = ★ hlavní technik etapy (jinak zakázky). Zakázky bez přiřazeného technika jsou „Bez hlavního technika“.',
  async rozpad(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = await db.predavak.findMany({
      where: { orgId, podpisano: { gte: od, lt: doD } },
      select: PREDAVAK_PARTA,
    })
    const map = new Map<string, { nazev: string; pocet: number }>()
    for (const p of rows) {
      const t = partaPredavaku(p)
      const klic = t?.id ?? ''
      const r = map.get(klic) ?? { nazev: t?.jmeno ?? BEZ_PARTY, pocet: 0 }
      r.pocet++
      map.set(klic, r)
    }
    // Party podle počtu sestupně, „Bez hlavního technika“ vždy na konec
    const radky = Array.from(map.entries())
      .sort(([ka, a], [kb, b]) => (ka === '' ? 1 : kb === '' ? -1 : b.pocet - a.pocet || a.nazev.localeCompare(b.nazev, 'cs')))
      .map(([klic, r]) => ({ klic, nazev: r.nazev, hodnoty: [String(r.pocet), procento(r.pocet, rows.length)] }))
    return {
      nadpis: 'Podle party (★ hlavní technik)',
      sloupce: ['Dokončeno', 'Podíl'],
      radky,
      poznamka: 'Každá podepsaná etapa se počítá zvlášť. Partu určuje ★ hlavní technik v detailu zakázky nebo etapy.',
    }
  },
  async trend(db, orgId, mesice) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const rows = await db.predavak.findMany({
      where: { orgId, podpisano: { gte: od, lt: doD } },
      select: { podpisano: true, ...PREDAVAK_PARTA },
    })
    const map = seskup(rows, r => r.podpisano, mesice)
    return mesice.map(klic => {
      const r = map.get(klic) ?? []
      const party = new Set(r.map(p => partaPredavaku(p)?.id).filter(Boolean)).size
      return {
        klic,
        hodnota: r.length,
        detail: party ? `${party} ${party === 1 ? 'parta' : party < 5 ? 'party' : 'part'}, ø ${formatCislo(Math.round((r.length / party) * 10) / 10)}` : undefined,
      }
    })
  },
  async zaznamy(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = await db.predavak.findMany({
      where: { orgId, podpisano: { gte: od, lt: doD } },
      select: { id: true, cislo: true, zakazkaId: true, podpisano: true, ...PREDAVAK_PARTA },
      orderBy: { podpisano: 'asc' },
    })
    return rows.map(p => ({
      id: p.id,
      titulek: `${p.zakazka.cislo} · ${[p.zakazka.klient.jmeno, p.zakazka.klient.prijmeni].filter(Boolean).join(' ')}`,
      popis: [p.cislo, p.etapa ? `etapa ${p.etapa.cislo}` : null, p.zakazka.nazev, p.podpisano ? datumPraha(p.podpisano) : null]
        .filter(Boolean).join(' · '),
      hodnota: partaPredavaku(p)?.jmeno ?? BEZ_PARTY,
      href: `/zakazky/${p.zakazkaId}/predavaky/${p.id}`,
    }))
  },
}

/**
 * KPI 1 — SOD s uhrazenými ≥ 70 % ceny s DPH do rozhodného data (R1–R3):
 * první odeslaná objednávka materiálu zakázky, jinak podpis SOD + 14 dní.
 * Úhrady z ABRA Flexi (záloha i faktura, bez dobropisů) přes zakázku OP.
 * SOD před rozhodným datem „čeká“ a do hodnoty nevstupuje (Q3). Výjimky a
 * dodatky CRM zatím neeviduje.
 */
const ZALOHA_PODIL = 0.7
const DEN = 86_400_000

async function vyhodnotSod(db: OrgPrismaClient, orgId: string, od: Date, doD: Date, now: Date) {
  const sody = await db.sod.findMany({
    where: { orgId, stav: 'PODEPSANO', podepsano: { gte: od, lt: doD } },
    select: {
      id: true, cislo: true, klientJmeno: true, cenaSDph: true, podepsano: true, dealId: true,
      deal: {
        select: {
          zakazky: {
            select: {
              id: true, cislo: true,
              objednavky: { where: { odeslano: { not: null } }, select: { odeslano: true } },
              abraFaktury: { where: { typ: { in: ['ZALOHA', 'FAKTURA'] } }, select: { celkemSDph: true, zbyvaUhradit: true, uhrazeno: true } },
            },
          },
        },
      },
    },
    orderBy: { podepsano: 'asc' },
  })
  return sody.map(s => {
    const zakazky = s.deal.zakazky
    const objednano = zakazky.flatMap(z => z.objednavky.map(o => o.odeslano!)).sort((a, b) => a.getTime() - b.getTime())[0]
    const rozhodne = objednano ?? new Date(s.podepsano!.getTime() + 14 * DEN)
    // Flexi zná jen den úhrady — uhrazeno v den rozhodného data ještě platí
    const uzaverka = prahaDen(rozhodne)
    const uhrazeno = zakazky.flatMap(z => z.abraFaktury)
      .filter(f => f.uhrazeno && f.uhrazeno <= uzaverka)
      .reduce((sum, f) => sum + Number(f.celkemSDph) - Number(f.zbyvaUhradit), 0)
    const cena = Number(s.cenaSDph ?? 0)
    const podil = cena > 0 ? uhrazeno / cena : null
    const stav = rozhodne > now ? 'CEKA' as const : podil !== null && podil >= ZALOHA_PODIL ? 'SPLNENO' as const : 'NESPLNENO' as const
    return { ...s, zakazka: zakazky[0] ?? null, rozhodne, objednano: !!objednano, uhrazeno, cena, podil, stav }
  })
}

const zalohy: KpiPocitadlo = {
  zaznamyNadpis: 'Smlouvy podepsané v měsíci, které 70 % zálohy nesplnily nebo ještě čekají',
  poznamka: 'Úhrady z ABRA Flexi. Rozhodné datum = první odeslaná objednávka materiálu, jinak 14 dní od podpisu SOD; do té doby SOD čeká. Faktura se k zakázce přiřadí, jen když má ve Flexi vyplněné číslo zakázky.',
  async trend(db, orgId, mesice, now = new Date()) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const map = seskup(await vyhodnotSod(db, orgId, od, doD, now), s => s.podepsano, mesice)
    return mesice.map(klic => {
      const r = map.get(klic) ?? []
      const hodnocene = r.filter(s => s.stav !== 'CEKA')
      const splneno = hodnocene.filter(s => s.stav === 'SPLNENO').length
      const ceka = r.length - hodnocene.length
      return {
        klic,
        hodnota: hodnocene.length ? Math.round((splneno / hodnocene.length) * 1000) / 10 : null,
        detail: `${splneno} z ${hodnocene.length}${ceka ? `, ${ceka} čeká` : ''}`,
      }
    })
  },
  async zaznamy(db, orgId, mesic, now = new Date()) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = (await vyhodnotSod(db, orgId, od, doD, now)).filter(s => s.stav !== 'SPLNENO')
    return rows.map(s => ({
      id: s.id,
      titulek: `${s.cislo} · ${s.klientJmeno}`,
      popis: [
        s.stav === 'CEKA' ? `čeká do ${datumPraha(s.rozhodne)}` : `nesplněno k ${datumPraha(s.rozhodne)}`,
        s.objednano ? 'objednávka materiálu' : '14 dní od podpisu',
        s.zakazka ? `zakázka ${s.zakazka.cislo}` : 'bez zakázky',
        `uhrazeno ${formatKc(s.uhrazeno)} z ${formatKc(s.cena)}`,
      ].join(' · '),
      hodnota: s.podil !== null ? procento(s.uhrazeno, s.cena) : 'bez ceny',
      href: s.zakazka ? `/zakazky/${s.zakazka.id}` : `/deals/${s.dealId}`,
    }))
  },
}

/**
 * KPI 2 — kalendářní dny od podpisu předávacího protokolu do první faktury
 * z ABRA Flexi vystavené ten den nebo později (R4). Každá etapa zvlášť: faktura
 * s koncovkou jiné etapy (26-047-2) se k etapě 1 nepočítá. Nevyfakturované
 * předání se počítá dny do dneška — hodnota roste, dokud faktura nevznikne.
 */
async function predaniFaktury(db: OrgPrismaClient, orgId: string, od: Date, doD: Date, now: Date) {
  const rows = await db.predavak.findMany({
    where: { orgId, podpisano: { gte: od, lt: doD } },
    select: {
      id: true, cislo: true, zakazkaId: true, podpisano: true,
      etapa: { select: { cislo: true } },
      zakazka: {
        select: {
          cislo: true, klient: { select: { jmeno: true, prijmeni: true } },
          abraFaktury: { where: { typ: 'FAKTURA' }, select: { kod: true, vystaveno: true, etapaCislo: true }, orderBy: { vystaveno: 'asc' } },
        },
      },
    },
    orderBy: { podpisano: 'asc' },
  })
  const dnes = prahaDen(now)
  return rows.map(p => {
    const den = prahaDen(p.podpisano!)
    const faktura = p.zakazka.abraFaktury.find(f =>
      f.vystaveno >= den && (!p.etapa || f.etapaCislo === null || f.etapaCislo === p.etapa.cislo))
    const dny = Math.round(((faktura?.vystaveno ?? dnes).getTime() - den.getTime()) / DEN)
    return { ...p, faktura: faktura ?? null, dny }
  })
}

const fakturace: KpiPocitadlo = {
  zaznamyNadpis: 'Předání v měsíci a dny do faktury',
  poznamka: 'Faktury z ABRA Flexi. Bez faktury se počítají dny do dneška. Faktura se k zakázce přiřadí, jen když má ve Flexi vyplněné číslo zakázky (u etapy s koncovkou, např. 26-047-2).',
  async trend(db, orgId, mesice, now = new Date()) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const map = seskup(await predaniFaktury(db, orgId, od, doD, now), p => p.podpisano, mesice)
    return mesice.map(klic => {
      const r = map.get(klic) ?? []
      const bez = r.filter(p => !p.faktura).length
      return {
        klic,
        hodnota: r.length ? Math.round((r.reduce((s, p) => s + p.dny, 0) / r.length) * 10) / 10 : null,
        detail: `${r.length} předání${bez ? `, ${bez} bez faktury` : ''}`,
      }
    })
  },
  async zaznamy(db, orgId, mesic, now = new Date()) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = await predaniFaktury(db, orgId, od, doD, now)
    return rows.sort((a, b) => Number(!!a.faktura) - Number(!!b.faktura) || b.dny - a.dny).map(p => ({
      id: p.id,
      titulek: `${p.zakazka.cislo} · ${[p.zakazka.klient.jmeno, p.zakazka.klient.prijmeni].filter(Boolean).join(' ')}`,
      popis: [
        p.cislo, p.etapa ? `etapa ${p.etapa.cislo}` : null, `předáno ${datumPraha(p.podpisano!)}`,
        p.faktura ? `faktura ${p.faktura.kod} ${datumPraha(p.faktura.vystaveno)}` : 'bez faktury',
      ].filter(Boolean).join(' · '),
      hodnota: `${p.dny} d`,
      href: `/zakazky/${p.zakazkaId}/predavaky/${p.id}`,
    }))
  },
}

export const POCITADLA: Partial<Record<KpiKod, KpiPocitadlo>> = {
  ZALOHY: zalohy,
  FAKTURACE: fakturace,
  KONVERZE: konverze,
  MATERIAL_BEZ_ZAKAZKY: materialBezZakazky,
  PARTY: party,
}
