/**
 * Jednotné formátování čísel, měny a dat pro celou aplikaci.
 * Nepoužívej inline `toLocaleString`/`toLocaleDateString` — stejná hodnota
 * pak vypadá na každé obrazovce jinak (hlídá ESLint no-restricted-syntax).
 */

/* eslint-disable no-restricted-syntax */

const nfKc = new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 })
const nfKcDesetiny = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
const nfCislo = new Intl.NumberFormat('cs-CZ')

/** „12 345 Kč" — celé koruny (výchozí pro ceny v UI). */
export function formatKc(n: number): string {
  return `${nfKc.format(n)} Kč`
}

/** „12 345,50 Kč" — s haléři, jen když jsou (vyúčtování, položky). */
export function formatKcPresne(n: number): string {
  return `${nfKcDesetiny.format(n)} Kč`
}

/** „12 345,00 Kč" — účetní formát, vždy 2 desetinná místa (faktury, vyúčtování). */
const nfKcUcetni = new Intl.NumberFormat('cs-CZ', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export function formatKcUcetni(n: number): string {
  return `${nfKcUcetni.format(n)} Kč`
}

/** „1,2 M Kč" / „350 tis. Kč" / „950 Kč" — kompaktní pro KPI a kanban karty. */
export function formatKcCompact(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M Kč`
  if (Math.abs(n) >= 1_000) return `${Math.round(n / 1_000)} tis. Kč`
  return `${nfKc.format(n)} Kč`
}

/** „12 345" — číslo bez jednotky v českém formátu. */
export function formatCislo(n: number): string {
  return nfCislo.format(n)
}

/** „14. 7. 2026" — výchozí datum. */
export function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('cs-CZ')
}

/** „14. 7." — krátké datum bez roku (seznamy, kalendáře). */
export function formatDateKratke(d: Date | string): string {
  return new Date(d).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'numeric' })
}

/** „14. 7. 2026 9:30" — datum s časem. */
export function formatDateTime(d: Date | string): string {
  return new Date(d).toLocaleString('cs-CZ', {
    day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

/** „9:30" — jen čas. */
export function formatCas(d: Date | string): string {
  return new Date(d).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

/**
 * „Dnes" / „Zítra" / „Včera" / „14. čvc" — relativní datum pro seznamy
 * a nástěnku. Pro vzdálenější data vrací krátké datum s měsícem slovem.
 */
export function formatRelative(d: Date | string): string {
  const date = new Date(d)
  const today = new Date()
  const diff = Math.round(
    (new Date(date.toDateString()).getTime() - new Date(today.toDateString()).getTime()) / 86_400_000
  )
  if (diff === 0) return 'Dnes'
  if (diff === 1) return 'Zítra'
  if (diff === -1) return 'Včera'
  return date.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}
