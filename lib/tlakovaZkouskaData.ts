// Protokol o tlakové zkoušce (podlahové vytápění dle ČSN EN 1264-4 + tepelné čerpadlo).
// Čistý datový typ + validace vstupu z formuláře — sdílí API route, HTML šablona a dialog.

export type Medium = 'VODA' | 'VZDUCH'
export type Vysledek = 'VYHOVEL' | 'NEVYHOVEL'

export interface TlakovaZkouskaPodlahovka {
  trubkaTyp: string
  trubkaDimenze: string
  pocetOkruhu: number | null
  delkaM: number | null
  rozdelovac: string
  medium: Medium
  zkusebniTlak: number | null
  provozniTlak: number | null
  dobaH: number | null
  tlakZacatek: number | null
  tlakKonec: number | null
  teplota: number | null
  podTlakemPriBetonazi: boolean
}

export interface TlakovaZkouskaDusik {
  tlak: number | null
  dobaH: number | null
  vakuumPa: number | null
  dobaVakuaMin: number | null
}

export interface TlakovaZkouskaTc {
  zkusebniTlak: number | null
  dobaH: number | null
  tlakZacatek: number | null
  tlakKonec: number | null
  dusik: TlakovaZkouskaDusik | null
}

export interface TlakovaZkouskaVstup {
  /** YYYY-MM-DD */
  datum: string
  zkousel: string
  podlahovka: TlakovaZkouskaPodlahovka | null
  tc: TlakovaZkouskaTc | null
  vysledek: Vysledek
  poznamka: string
}

export const VYCHOZI_PODLAHOVKA: TlakovaZkouskaPodlahovka = {
  trubkaTyp: 'PE-Xa', trubkaDimenze: '16×2', pocetOkruhu: null, delkaM: null, rozdelovac: '',
  medium: 'VODA', zkusebniTlak: 6, provozniTlak: null, dobaH: 24, tlakZacatek: null, tlakKonec: null,
  teplota: null, podTlakemPriBetonazi: false,
}

export const VYCHOZI_TC: TlakovaZkouskaTc = {
  zkusebniTlak: null, dobaH: null, tlakZacatek: null, tlakKonec: null, dusik: null,
}

export const VYCHOZI_DUSIK: TlakovaZkouskaDusik = { tlak: null, dobaH: null, vakuumPa: null, dobaVakuaMin: null }

/** Pokles tlaku (začátek − konec), null když chybí některá hodnota */
export function pokles(zacatek: number | null, konec: number | null): number | null {
  if (zacatek == null || konec == null) return null
  return Math.round((zacatek - konec) * 1000) / 1000
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
  return Number.isFinite(n) && Math.abs(n) < 1e7 ? n : null
}

function str(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

/** Validace těla požadavku → vstup protokolu, nebo chybová hláška */
export function parseTlakovaZkouska(body: unknown): TlakovaZkouskaVstup | string {
  const b = obj(body)
  if (!b) return 'Neplatná data'
  const datum = str(b.datum, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datum) || isNaN(new Date(datum).getTime())) return 'Vyplňte datum zkoušky'

  const p = obj(b.podlahovka)
  const podlahovka: TlakovaZkouskaPodlahovka | null = p ? {
    trubkaTyp: str(p.trubkaTyp, 40),
    trubkaDimenze: str(p.trubkaDimenze, 40),
    pocetOkruhu: num(p.pocetOkruhu),
    delkaM: num(p.delkaM),
    rozdelovac: str(p.rozdelovac),
    medium: p.medium === 'VZDUCH' ? 'VZDUCH' : 'VODA',
    zkusebniTlak: num(p.zkusebniTlak),
    provozniTlak: num(p.provozniTlak),
    dobaH: num(p.dobaH),
    tlakZacatek: num(p.tlakZacatek),
    tlakKonec: num(p.tlakKonec),
    teplota: num(p.teplota),
    podTlakemPriBetonazi: p.podTlakemPriBetonazi === true,
  } : null

  const t = obj(b.tc)
  const d = t ? obj(t.dusik) : null
  const tc: TlakovaZkouskaTc | null = t ? {
    zkusebniTlak: num(t.zkusebniTlak),
    dobaH: num(t.dobaH),
    tlakZacatek: num(t.tlakZacatek),
    tlakKonec: num(t.tlakKonec),
    dusik: d ? { tlak: num(d.tlak), dobaH: num(d.dobaH), vakuumPa: num(d.vakuumPa), dobaVakuaMin: num(d.dobaVakuaMin) } : null,
  } : null

  if (!podlahovka && !tc) return 'Zvolte aspoň jednu zkoušku (podlahové vytápění nebo tepelné čerpadlo)'
  if (b.vysledek !== 'VYHOVEL' && b.vysledek !== 'NEVYHOVEL') return 'Zvolte výsledek zkoušky'

  return {
    datum,
    zkousel: str(b.zkousel, 80),
    podlahovka,
    tc,
    vysledek: b.vysledek,
    poznamka: str(b.poznamka, 2000),
  }
}
