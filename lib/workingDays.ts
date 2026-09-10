/**
 * Pracovní dny (po–pá) pro termíny smlouvy o dílo. Státní svátky se
 * nezohledňují — smlouva uvádí orientační počet, obchodník ho může přepsat.
 */

export function isoToDate(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(iso + 'T12:00:00')
  return isNaN(d.getTime()) ? null : d
}

export function dateToIso(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${dd}`
}

/** Počet pracovních dnů od–do včetně obou krajů; 0 při neplatném/obráceném rozsahu. */
export function countWorkingDays(fromIso: string, toIso: string): number {
  const from = isoToDate(fromIso)
  const to = isoToDate(toIso)
  if (!from || !to || to < from) return 0
  let n = 0
  const cur = new Date(from)
  while (cur <= to) {
    const dow = cur.getDay()
    if (dow !== 0 && dow !== 6) n++
    cur.setDate(cur.getDate() + 1)
  }
  return n
}

/** „15. 9. 2026" z ISO data (bez závislosti na časové zóně serveru). */
export function formatIsoCz(iso: string): string {
  const d = isoToDate(iso)
  if (!d) return iso
  return `${d.getDate()}. ${d.getMonth() + 1}. ${d.getFullYear()}`
}
