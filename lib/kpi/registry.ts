/**
 * Registr KPI vedení (docs/kpi-vedeni/01-specifikace.md). Jediný zdroj kódů,
 * výchozích cílů a toho, co je ve které fázi spočitatelné.
 */
export const KPI_KODY = [
  'ZALOHY', 'FAKTURACE', 'HOTOVOST', 'MARZE', 'MATERIAL_BEZ_ZAKAZKY',
  'KONVERZE', 'ADS_CENA', 'PARTY', 'HODINY_JEDNATELU', 'ZISK',
] as const
export type KpiKod = (typeof KPI_KODY)[number]

export type KpiJednotka = '%' | 'dny' | 'Kč' | 'h' | 'ks'
/** VYSSI = čím víc, tím líp (cíl je minimum); NIZSI = cíl je maximum */
export type KpiSmer = 'VYSSI' | 'NIZSI'

export interface KpiDef {
  kod: KpiKod
  /** Číslo ze zadání (1–10) */
  cislo: number
  nazev: string
  popis: string
  jednotka: KpiJednotka
  smer: KpiSmer
  vychoziCil: number | null
  granularita: 'TYDEN' | 'MESIC'
  faze: 1 | 2 | 3
  /** Fáze 1 umí spočítat; ostatní ukazují, co chybí */
  dostupne: boolean
  /** Co chybí, dokud KPI není dostupné */
  chybi?: string
}

export const KPI_DEFS: KpiDef[] = [
  {
    kod: 'ZALOHY', cislo: 1, nazev: 'SOD se zálohou 70 %', jednotka: '%', smer: 'VYSSI', vychoziCil: 90,
    popis: 'Podíl podepsaných SOD, u kterých je před objednáním materiálu (jinak do 14 dní od podpisu) uhrazeno min. 70 % ceny s DPH.',
    granularita: 'TYDEN', faze: 2, dostupne: false, chybi: 'Evidence faktur a úhrad záloh (fáze 2).',
  },
  {
    kod: 'FAKTURACE', cislo: 2, nazev: 'Předání → faktura', jednotka: 'dny', smer: 'NIZSI', vychoziCil: 1,
    popis: 'Kalendářní dny od podpisu předávacího protokolu zákazníkem do první vyúčtovací faktury, každá etapa zvlášť.',
    granularita: 'TYDEN', faze: 2, dostupne: false, chybi: 'Evidence vyúčtovacích faktur (fáze 2).',
  },
  {
    kod: 'HOTOVOST', cislo: 3, nazev: 'Hotovost', jednotka: 'Kč', smer: 'VYSSI', vychoziCil: 0,
    popis: 'Zůstatek účtu a čerpání kontokorentu, cíl kladná hotovost.',
    granularita: 'TYDEN', faze: 3, dostupne: false, chybi: 'Týdenní ruční zadání zůstatku (fáze 3), později ABRA Flexi.',
  },
  {
    kod: 'MARZE', cislo: 4, nazev: 'Hrubá marže po zakázce', jednotka: '%', smer: 'VYSSI', vychoziCil: 35,
    popis: 'Vyfakturováno bez DPH minus materiál, práce (hodiny × vnitřní sazba), subdodávky a provize, po vyúčtování zakázky.',
    granularita: 'MESIC', faze: 2, dostupne: false, chybi: 'Faktury, výkaz hodin a sazby, subdodávky a provize (fáze 2).',
  },
  {
    kod: 'MATERIAL_BEZ_ZAKAZKY', cislo: 5, nazev: 'Materiál bez zakázky', jednotka: 'Kč', smer: 'NIZSI', vychoziCil: 1,
    popis: 'Výdeje ze skladu bez zakázky mimo provozní spotřebu v nákupních cenách. Cíl max. 1 % tržeb — procento až s evidencí faktur.',
    granularita: 'MESIC', faze: 1, dostupne: true,
  },
  {
    kod: 'KONVERZE', cislo: 6, nazev: 'Konverze leadů', jednotka: '%', smer: 'VYSSI', vychoziCil: null,
    popis: 'Vyhrané obchodní případy / leady podle měsíce vzniku leadu. Rozpad podle zdroje přijde s evidencí zdroje (fáze 2).',
    granularita: 'MESIC', faze: 1, dostupne: true,
  },
  {
    kod: 'ADS_CENA', cislo: 7, nazev: 'Cena za případ z Google Ads', jednotka: 'Kč', smer: 'NIZSI', vychoziCil: null,
    popis: 'Měsíční útrata za Google Ads / vyhrané případy se zdrojem Google Ads.',
    granularita: 'MESIC', faze: 3, dostupne: false, chybi: 'Zdroj poptávky (fáze 2) a měsíční útrata za Ads (fáze 3).',
  },
  {
    kod: 'PARTY', cislo: 8, nazev: 'Dokončené zakázky', jednotka: 'ks', smer: 'VYSSI', vychoziCil: null,
    popis: 'Podepsané předávací protokoly v měsíci. Rozpad na montážní party přijde s evidencí part (fáze 2).',
    granularita: 'MESIC', faze: 1, dostupne: true,
  },
  {
    kod: 'HODINY_JEDNATELU', cislo: 9, nazev: 'Hodiny jednatelů na montáži', jednotka: 'h', smer: 'NIZSI', vychoziCil: 0,
    popis: 'Součet výkazů práce uživatelů s rolí Jednatel, cíl nula do konce 2027.',
    granularita: 'MESIC', faze: 2, dostupne: false, chybi: 'Výkaz hodin na zakázce (fáze 2).',
  },
  {
    kod: 'ZISK', cislo: 10, nazev: 'Zisk běžného provozu', jednotka: '%', smer: 'VYSSI', vychoziCil: 6,
    popis: 'Výsledek hospodaření bez jednorázových položek / tržby.',
    granularita: 'MESIC', faze: 3, dostupne: false, chybi: 'Měsíční ruční zadání výsledku (fáze 3), později ABRA Flexi.',
  },
]

export function kpiDef(kod: string): KpiDef | undefined {
  return KPI_DEFS.find(d => d.kod === kod)
}

export function isKpiKod(v: unknown): v is KpiKod {
  return typeof v === 'string' && (KPI_KODY as readonly string[]).includes(v)
}
