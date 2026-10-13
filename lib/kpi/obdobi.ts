/**
 * Období KPI v pražském čase. DB ukládá UTC, měsíc se ale počítá podle
 * kalendáře firmy (podpis 31. 10. ve 23:30 SELČ patří do října).
 */
const TZ = 'Europe/Prague'
/** Historie KPI od 1. 1. 2026 (R17) */
export const HISTORIE_OD = '2026-01'

const fmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

function casti(d: Date) {
  const p = Object.fromEntries(fmt.formatToParts(d).map(x => [x.type, x.value]))
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), min: Number(p.minute), s: Number(p.second) }
}

/** Posun pražského času proti UTC v ms pro daný okamžik */
function posun(d: Date) {
  const c = casti(d)
  return Date.UTC(c.y, c.m - 1, c.d, c.h, c.min, c.s) - Math.floor(d.getTime() / 1000) * 1000
}

/** Okamžik pražské půlnoci daného dne */
export function prahaPulnoc(y: number, m: number, d: number): Date {
  const odhad = Date.UTC(y, m - 1, d)
  let t = odhad - posun(new Date(odhad))
  t = odhad - posun(new Date(t))
  return new Date(t)
}

/** Klíč měsíce „YYYY-MM“ v pražském čase */
export function mesicKlic(d: Date): string {
  const c = casti(d)
  return `${c.y}-${String(c.m).padStart(2, '0')}`
}

export function isMesicKlic(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v)
}

function rozloz(klic: string) {
  const [y, m] = klic.split('-').map(Number)
  return { y, m }
}

export function posunMesic(klic: string, o: number): string {
  const { y, m } = rozloz(klic)
  const i = y * 12 + (m - 1) + o
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`
}

/** [od, do) jako UTC okamžiky */
export function mesicRozsah(klic: string): { od: Date; do: Date } {
  const { y, m } = rozloz(klic)
  const dalsi = rozloz(posunMesic(klic, 1))
  return { od: prahaPulnoc(y, m, 1), do: prahaPulnoc(dalsi.y, dalsi.m, 1) }
}

/** Měsíce od HISTORIE_OD (nebo posledních `max`) do aktuálního včetně */
export function mesiceTrendu(now: Date, max = 12): string[] {
  const aktualni = mesicKlic(now)
  const out: string[] = []
  for (let k = aktualni; k >= HISTORIE_OD && out.length < max; k = posunMesic(k, -1)) out.unshift(k)
  return out
}

const fmtDatum = new Intl.DateTimeFormat('cs-CZ', { timeZone: TZ, day: 'numeric', month: 'numeric', year: 'numeric' })

/** „14. 7. 2026“ v pražském čase (server běží v UTC) */
export function datumPraha(d: Date): string {
  return fmtDatum.format(d)
}

const MESICE = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
const MESICE_KRATKE = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']

export function mesicLabel(klic: string, kratky = false): string {
  const { y, m } = rozloz(klic)
  return kratky ? `${MESICE_KRATKE[m - 1]} ${String(y).slice(2)}` : `${MESICE[m - 1]} ${y}`
}
