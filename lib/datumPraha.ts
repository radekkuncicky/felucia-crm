/**
 * Kalendářní den v Praze. Server běží v UTC, takže `new Date().getDate()`
 * mezi půlnocí a 1–2 h ráno pražského času vrací ještě včerejšek.
 * Aktivity bez času ukládáme jako UTC půlnoc daného dne — rozsahy proto
 * vracíme v UTC půlnocích.
 */

const FMT = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Prague' })

/** Dnešek v Praze jako „YYYY-MM-DD“ */
export function dnesPraha(now = new Date()): string {
  return FMT.format(now)
}

/** „YYYY-MM-DD“ posunuté o `dny` */
export function posunDen(ymd: string, dny: number): string {
  const d = new Date(`${ymd}T00:00:00.000Z`)
  d.setUTCDate(d.getUTCDate() + dny)
  return d.toISOString().slice(0, 10)
}

/** Zítřek v Praze jako „YYYY-MM-DD“ */
export function zitraPraha(now = new Date()): string {
  return posunDen(dnesPraha(now), 1)
}

/** Dnešní pražský den jako [od, do) v UTC půlnocích — pro where na `datum` */
export function dnesPrahaRozsah(now = new Date()): { od: Date; do: Date } {
  const dnes = dnesPraha(now)
  return { od: new Date(`${dnes}T00:00:00.000Z`), do: new Date(`${posunDen(dnes, 1)}T00:00:00.000Z`) }
}
