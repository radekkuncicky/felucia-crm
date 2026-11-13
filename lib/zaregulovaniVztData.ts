// Protokol o zaregulování vzduchotechnické soustavy (VZT / rekuperace)
// dle ČSN EN 12599 (zkoušky a měření při předávání VZT) a ČSN EN 14134 (obytné větrací systémy).
// Čistý datový typ + výpočty + validace vstupu — sdílí API route, HTML šablona a dialog.

export type Vysledek = 'VYHOVEL' | 'NEVYHOVEL'
export type TypVyustky = 'PRIVOD' | 'ODVOD'

export interface VztVyustka {
  mistnost: string
  typ: TypVyustky
  /** typ / označení vyústky nebo talířového ventilu */
  prvek: string
  /** projektovaný průtok [m³/h] */
  navrh: number | null
  /** naměřený průtok [m³/h] */
  namereno: number | null
  /** nastavení regulačního prvku (otáčky ventilu, poloha klapky…) */
  nastaveni: string
}

export interface ZaregulovaniVztVstup {
  /** YYYY-MM-DD */
  datum: string
  provedl: string
  jednotka: { typ: string; vyrobniCislo: string; umisteni: string; rezim: string }
  pristroj: { typ: string; vyrobniCislo: string; /** YYYY-MM-DD nebo '' */ kalibrace: string }
  metoda: string
  celkem: { privodNavrh: number | null; privodNamereno: number | null; odvodNavrh: number | null; odvodNamereno: number | null }
  teploty: { venkovni: number | null; privod: number | null; odvod: number | null; odpadni: number | null }
  /** povolená odchylka průtoku na koncovém prvku [± %] */
  tolerance: number
  vyustky: VztVyustka[]
  kontroly: Record<KontrolaKey, boolean>
  vysledek: Vysledek
  poznamka: string
}

export const KONTROLY = [
  { key: 'filtry', label: 'Filtry osazeny, čisté' },
  { key: 'kondenzat', label: 'Odvod kondenzátu funkční (sifon zavodněn)' },
  { key: 'potrubi', label: 'Potrubí utěsněno, sání a výfuk izolovány' },
  { key: 'prvky', label: 'Regulační prvky zajištěny v nastavené poloze' },
  { key: 'hluk', label: 'Hluk a vibrace bez závad' },
  { key: 'regulace', label: 'Ovladač nastaven, provozní režimy ověřeny' },
  { key: 'zaskoleni', label: 'Uživatel zaškolen (obsluha, výměna filtrů)' },
] as const

export type KontrolaKey = (typeof KONTROLY)[number]['key']

export const VYCHOZI_TOLERANCE = 15
export const METODY = ['Balometr (měřicí nástavec)', 'Anemometr s nástavcem', 'Tlaková sonda / Prandtlova trubice', 'Měření tlakové diference na ventilu'] as const
export const MAX_VYUSTEK = 60

const r1 = (n: number) => Math.round(n * 10) / 10

/** Odchylka naměřeno vs. návrh [%], null když chybí hodnota nebo je návrh 0 */
export function odchylka(navrh: number | null, namereno: number | null): number | null {
  if (navrh == null || namereno == null || navrh === 0) return null
  return r1(((namereno - navrh) / navrh) * 100)
}

export function vTolerance(odch: number | null, tolerance: number): boolean | null {
  return odch == null ? null : Math.abs(odch) <= tolerance
}

/** Teplotní účinnost rekuperace η = (t_přívod − t_venkovní) / (t_odvod − t_venkovní) [%] */
export function teplotniUcinnost(t: ZaregulovaniVztVstup['teploty']): number | null {
  const { venkovni, privod, odvod } = t
  if (venkovni == null || privod == null || odvod == null) return null
  const rozdil = odvod - venkovni
  if (Math.abs(rozdil) < 3) return null // malý teplotní rozdíl → výsledek nemá vypovídací hodnotu
  const eta = ((privod - venkovni) / rozdil) * 100
  return eta < 0 || eta > 110 ? null : r1(eta)
}

/** Součet průtoků vyústek daného typu (naměřené / návrh) */
export function soucet(vyustky: VztVyustka[], typ: TypVyustky, pole: 'navrh' | 'namereno'): number | null {
  const hodnoty = vyustky.filter((v) => v.typ === typ && v[pole] != null).map((v) => v[pole] as number)
  return hodnoty.length ? r1(hodnoty.reduce((s, n) => s + n, 0)) : null
}

/** Nerovnováha přívod − odvod (naměřeno) v % odvodu */
export function nerovnovaha(privod: number | null, odvod: number | null): number | null {
  if (privod == null || odvod == null || odvod === 0) return null
  return r1(((privod - odvod) / odvod) * 100)
}

function num(v: unknown): number | null {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
  return Number.isFinite(n) && Math.abs(n) < 1e7 ? n : null
}

function str(v: unknown, max = 120): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}
}

const jeDatum = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime())

/** Validace těla požadavku → vstup protokolu, nebo chybová hláška */
export function parseZaregulovaniVzt(body: unknown): ZaregulovaniVztVstup | string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Neplatná data'
  const b = obj(body)
  const datum = str(b.datum, 10)
  if (!jeDatum(datum)) return 'Vyplňte datum měření'

  const j = obj(b.jednotka)
  const p = obj(b.pristroj)
  const c = obj(b.celkem)
  const t = obj(b.teploty)
  const k = obj(b.kontroly)
  const kalibrace = str(p.kalibrace, 10)

  const vyustky: VztVyustka[] = (Array.isArray(b.vyustky) ? b.vyustky : [])
    .map((raw): VztVyustka => {
      const v = obj(raw)
      return {
        mistnost: str(v.mistnost, 60),
        typ: v.typ === 'ODVOD' ? 'ODVOD' : 'PRIVOD',
        prvek: str(v.prvek, 60),
        navrh: num(v.navrh),
        namereno: num(v.namereno),
        nastaveni: str(v.nastaveni, 40),
      }
    })
    .filter((v) => v.mistnost || v.prvek || v.navrh != null || v.namereno != null)
  if (vyustky.length > MAX_VYUSTEK) return `Nejvýše ${MAX_VYUSTEK} vyústek`

  const celkem = {
    privodNavrh: num(c.privodNavrh), privodNamereno: num(c.privodNamereno),
    odvodNavrh: num(c.odvodNavrh), odvodNamereno: num(c.odvodNamereno),
  }
  const nejakeMereni = celkem.privodNamereno != null || celkem.odvodNamereno != null || vyustky.some((v) => v.namereno != null)
  if (!nejakeMereni) return 'Vyplňte aspoň jeden naměřený průtok (celkový nebo na vyústce)'
  if (b.vysledek !== 'VYHOVEL' && b.vysledek !== 'NEVYHOVEL') return 'Zvolte výsledek'

  const tol = num(b.tolerance)
  return {
    datum,
    provedl: str(b.provedl, 80),
    jednotka: { typ: str(j.typ), vyrobniCislo: str(j.vyrobniCislo, 60), umisteni: str(j.umisteni), rezim: str(j.rezim, 60) },
    pristroj: { typ: str(p.typ), vyrobniCislo: str(p.vyrobniCislo, 60), kalibrace: jeDatum(kalibrace) ? kalibrace : '' },
    metoda: str(b.metoda, 80),
    celkem,
    teploty: { venkovni: num(t.venkovni), privod: num(t.privod), odvod: num(t.odvod), odpadni: num(t.odpadni) },
    tolerance: tol != null && tol > 0 && tol <= 50 ? tol : VYCHOZI_TOLERANCE,
    vyustky,
    kontroly: Object.fromEntries(KONTROLY.map(({ key }) => [key, k[key] === true])) as Record<KontrolaKey, boolean>,
    vysledek: b.vysledek,
    poznamka: str(b.poznamka, 2000),
  }
}
