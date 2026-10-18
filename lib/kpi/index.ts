/**
 * KPI vedení — skládá registr, nastavení org (KpiNastaveni), výpočty a semafor.
 * Sdílí Nástěnka, /kpi, /kpi/[kod] i pondělní souhrn ve workeru.
 */
import { orgPrisma, type OrgPrismaClient } from '../orgPrisma'
import { getOrgSettings } from '../orgSettings'
import type { Permissions } from '../permissions'
import { formatCislo, formatKc } from '../format'
import { KPI_DEFS, kpiDef, type KpiDef, type KpiKod, type KpiJednotka } from './registry'
import { semafor, type Semafor } from './semafor'
import { mesicKlic, mesiceTrendu, posunMesic, mesicLabel } from './obdobi'
import { POCITADLA, type KpiBod, type KpiRozpad, type KpiZaznam } from './vypocty'

export type { KpiKod } from './registry'
export type { Semafor } from './semafor'
export type { KpiBod, KpiRozpad, KpiZaznam } from './vypocty'

export interface KpiNastaveniEfektivni {
  kod: KpiKod
  aktivni: boolean
  cil: number | null
  poradi: number
}

export interface KpiVysledek {
  def: KpiDef
  nastaveni: KpiNastaveniEfektivni
  /** Hodnota za poslední uzavřený měsíc */
  hodnota: number | null
  hodnotaDetail?: string
  /** Měsíc hodnoty „YYYY-MM“ */
  mesic: string
  /** Průběžná hodnota aktuálního měsíce */
  prubezne: number | null
  /** Jednotka zobrazené hodnoty a cíle (fáze 1 může cíl porovnat jen ve stejné jednotce) */
  jednotka: KpiJednotka
  /** Cíl porovnatelný s hodnotou (jinak null — KPI 5 má cíl v % tržeb, hodnotu zatím v Kč) */
  cilPorovnatelny: number | null
  semafor: Semafor
  trend: KpiBod[]
  poznamka?: string
}

/** Smí uživatel KPI vidět? Modul zapnutý v org + oprávnění `kpi`. */
export async function kpiPristup(orgId: string, perms: Permissions): Promise<boolean> {
  if (!perms.kpi) return false
  const s = await getOrgSettings(orgId)
  return s.modulKpi
}

export async function nactiNastaveni(db: OrgPrismaClient, orgId: string): Promise<KpiNastaveniEfektivni[]> {
  const rows = await db.kpiNastaveni.findMany({ where: { orgId } })
  const map = new Map(rows.map(r => [r.kod, r]))
  return KPI_DEFS.map(def => {
    const r = map.get(def.kod)
    return {
      kod: def.kod,
      aktivni: r ? r.aktivni : def.dostupne,
      cil: r ? (r.cil !== null ? Number(r.cil) : null) : def.vychoziCil,
      poradi: r ? r.poradi : def.cislo,
    }
  }).sort((a, b) => a.poradi - b.poradi)
}

/** Cíl jde porovnat s hodnotou jen ve stejné jednotce (KPI 5 ve fázi 1: Kč vs. % tržeb). */
function porovnatelnyCil(def: KpiDef, cil: number | null) {
  if (def.kod === 'MATERIAL_BEZ_ZAKAZKY') return null
  return cil
}

async function vypocti(db: OrgPrismaClient, orgId: string, def: KpiDef, nast: KpiNastaveniEfektivni, now: Date): Promise<KpiVysledek> {
  const aktualni = mesicKlic(now)
  const uzavreny = posunMesic(aktualni, -1)
  const pocitadlo = POCITADLA[def.kod]
  const cil = porovnatelnyCil(def, nast.cil)
  if (!def.dostupne || !pocitadlo) {
    return {
      def, nastaveni: nast, hodnota: null, mesic: uzavreny, prubezne: null, jednotka: def.jednotka,
      cilPorovnatelny: cil, semafor: 'BEZ_DAT', trend: [], poznamka: def.chybi,
    }
  }
  const trend = await pocitadlo.trend(db, orgId, mesiceTrendu(now))
  const bod = trend.find(b => b.klic === uzavreny)
  const hodnota = bod?.hodnota ?? null
  return {
    def,
    nastaveni: nast,
    hodnota,
    hodnotaDetail: bod?.detail,
    mesic: uzavreny,
    prubezne: trend.find(b => b.klic === aktualni)?.hodnota ?? null,
    jednotka: def.jednotka,
    cilPorovnatelny: cil,
    semafor: semafor(hodnota, cil, def.smer),
    trend,
    poznamka: pocitadlo.poznamka,
  }
}

/** Přehled KPI org v pořadí z nastavení. `jenAktivni` = co se ukazuje na Nástěnce. */
export async function kpiPrehled(orgId: string, opts: { jenAktivni?: boolean; now?: Date } = {}): Promise<KpiVysledek[]> {
  const db = orgPrisma(orgId)
  const now = opts.now ?? new Date()
  const nastaveni = await nactiNastaveni(db, orgId)
  const vybrane = opts.jenAktivni ? nastaveni.filter(n => n.aktivni) : nastaveni
  return Promise.all(vybrane.map(n => vypocti(db, orgId, kpiDef(n.kod)!, n, now)))
}

export interface KpiDetail extends KpiVysledek {
  /** Měsíc, za který jsou záznamy */
  zaznamyMesic: string
  zaznamyNadpis: string
  zaznamy: KpiZaznam[]
  rozpad: KpiRozpad | null
}

export async function kpiDetail(orgId: string, kod: KpiKod, mesic?: string, now = new Date()): Promise<KpiDetail> {
  const db = orgPrisma(orgId)
  const nastaveni = (await nactiNastaveni(db, orgId)).find(n => n.kod === kod)!
  const def = kpiDef(kod)!
  const vysledek = await vypocti(db, orgId, def, nastaveni, now)
  const pocitadlo = POCITADLA[kod]
  const zaznamyMesic = mesic ?? vysledek.mesic
  return {
    ...vysledek,
    zaznamyMesic,
    zaznamyNadpis: pocitadlo?.zaznamyNadpis ?? '',
    zaznamy: def.dostupne && pocitadlo ? await pocitadlo.zaznamy(db, orgId, zaznamyMesic) : [],
    rozpad: def.dostupne && pocitadlo?.rozpad ? await pocitadlo.rozpad(db, orgId, zaznamyMesic) : null,
  }
}

/** Formát hodnoty pro dlaždice, souhrn i detail */
export function formatKpi(hodnota: number | null, jednotka: KpiJednotka): string {
  if (hodnota === null) return '—'
  const n = formatCislo(Math.round(hodnota * 10) / 10)
  switch (jednotka) {
    case '%': return `${n} %`
    case 'Kč': return formatKc(hodnota)
    case 'dny': return `${n} d`
    case 'h': return `${n} h`
    case 'ks': return n
  }
}

export function formatCil(def: KpiDef, cil: number | null): string {
  if (cil === null) return 'bez cíle'
  if (def.kod === 'MATERIAL_BEZ_ZAKAZKY') return `max. ${formatCislo(cil)} % tržeb`
  if (def.kod === 'ZALOHY') return `min. ${formatCislo(cil)} % smluv`
  if (def.kod === 'HOTOVOST') return 'kladná hotovost'
  const hodnota = formatKpi(cil, def.jednotka)
  return def.smer === 'VYSSI' ? `min. ${hodnota}` : `max. ${hodnota}`
}

export { mesicLabel }
