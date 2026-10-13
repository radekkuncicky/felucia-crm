/**
 * Výpočty KPI dostupných ve fázi 1. Každé KPI vrací trend po měsících a
 * záznamy, které ho kazí (proklik). Vše přes orgPrisma + explicitní orgId.
 * Objemy jsou malé (stovky řádků za rok), agreguje se v JS — bez raw SQL
 * nemusí řešit RLS kontext ani časová pásma v SQL.
 */
import type { OrgPrismaClient } from '../orgPrisma'
import type { KpiKod } from './registry'
import { formatKc } from '../format'
import { HISTORIE_OD, datumPraha, mesicKlic, mesicRozsah } from './obdobi'

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

export interface KpiPocitadlo {
  trend(db: OrgPrismaClient, orgId: string, mesice: string[]): Promise<KpiBod[]>
  zaznamy(db: OrgPrismaClient, orgId: string, mesic: string): Promise<KpiZaznam[]>
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

/** KPI 6 — vyhrané OP / leady podle měsíce vzniku leadu (R12) */
const konverze: KpiPocitadlo = {
  zaznamyNadpis: 'Leady měsíce, které nevedly k vyhranému případu',
  poznamka: 'Poslední měsíce se ještě dopočítávají — od poptávky k podpisu trvá týdny.',
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
      select: { id: true, jmeno: true, firma: true, status: true, sluzba: true, prevedenNaOp: { select: { stav: true } } },
      orderBy: { vytvoreno: 'asc' },
    })
    return leady.map(l => ({
      id: l.id,
      titulek: l.firma ? `${l.jmeno} (${l.firma})` : l.jmeno,
      popis: [LEAD_STATUS[l.status] ?? l.status, l.prevedenNaOp ? `OP: ${DEAL_STAV[l.prevedenNaOp.stav] ?? l.prevedenNaOp.stav}` : null, l.sluzba]
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

/** KPI 8 — dokončené = podepsaný předávací protokol v měsíci (R13), fáze 1 bez rozpadu na party */
const party: KpiPocitadlo = {
  zaznamyNadpis: 'Předávací protokoly podepsané v měsíci',
  poznamka: 'Zatím celkem za firmu — rozpad na montážní party přijde s evidencí part.',
  async trend(db, orgId, mesice) {
    const { od, do: doD } = rozsahMesicu(mesice)
    const rows = await db.predavak.findMany({
      where: { orgId, podpisano: { gte: od, lt: doD } },
      select: { podpisano: true },
    })
    const map = seskup(rows, r => r.podpisano, mesice)
    return mesice.map(klic => ({ klic, hodnota: map.get(klic)?.length ?? 0 }))
  },
  async zaznamy(db, orgId, mesic) {
    const { od, do: doD } = mesicRozsah(mesic)
    const rows = await db.predavak.findMany({
      where: { orgId, podpisano: { gte: od, lt: doD } },
      select: {
        id: true, cislo: true, zakazkaId: true, podpisano: true,
        etapa: { select: { cislo: true } },
        zakazka: { select: { cislo: true, nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
      },
      orderBy: { podpisano: 'asc' },
    })
    return rows.map(p => ({
      id: p.id,
      titulek: `${p.zakazka.cislo} · ${[p.zakazka.klient.jmeno, p.zakazka.klient.prijmeni].filter(Boolean).join(' ')}`,
      popis: [p.cislo, p.etapa ? `etapa ${p.etapa.cislo}` : null, p.zakazka.nazev, p.podpisano ? datumPraha(p.podpisano) : null]
        .filter(Boolean).join(' · '),
      href: `/zakazky/${p.zakazkaId}/predavaky/${p.id}`,
    }))
  },
}

export const POCITADLA: Partial<Record<KpiKod, KpiPocitadlo>> = {
  KONVERZE: konverze,
  MATERIAL_BEZ_ZAKAZKY: materialBezZakazky,
  PARTY: party,
}
