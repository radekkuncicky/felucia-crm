/**
 * Sdílená pravidla pro názvy a rozsahy událostí v kalendáři (web + ICS feed).
 *
 * Název události má vždy tvar: `Zákazník – Technologie – doplněk`
 *   např. "Jan Novák – Klimatizace – očekáváme přijetí zálohy"
 */

export const TECHNOLOGIE_LABEL: Record<string, string> = {
  KLIMA: 'Klimatizace',
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  JINE: 'Jiné',
}

export function technologieLabel(t: string | null | undefined): string {
  if (!t) return ''
  return TECHNOLOGIE_LABEL[t] ?? t
}

/** Doplněk názvu podle typu aktivity */
export const AKTIVITA_DOPLNEK: Record<string, string> = {
  HOVOR: 'hovor',
  EMAIL: 'e-mail',
  SCHUZKA: 'schůzka',
  UKOL: 'úkol',
  POZNAMKA: 'poznámka',
}

/** Technologie servisovaného zařízení (ZarizeniTyp) */
export const ZARIZENI_TYP_LABEL: Record<string, string> = {
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  KLIMATIZACE: 'Klimatizace',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_VYTAPENI: 'Podlahové vytápění',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
  OHREV_TV: 'Ohřev TV',
  JINE: 'Jiné',
}

/**
 * Technologie pro servisní návštěvu: typ zařízení (pokud není "Jiné"), jinak název zařízení.
 * Název kontraktu se do titulku nedává – často už jméno zákazníka obsahuje.
 */
export function servisTechnologie(zarizeni: { typ?: string | null; nazev?: string | null } | null | undefined): string {
  if (!zarizeni) return ''
  if (zarizeni.typ && zarizeni.typ !== 'JINE') return ZARIZENI_TYP_LABEL[zarizeni.typ] ?? zarizeni.typ
  return zarizeni.nazev ?? ''
}

/** Doplněk názvu podle typu servisní návštěvy (NavstevaTyp) */
export const SERVIS_DOPLNEK: Record<string, string> = {
  PLANOVANY_SERVIS: 'servisní návštěva',
  PORUCHA: 'porucha',
  ZARUCNI_OPRAVA: 'záruční oprava',
  POZARUCNI_OPRAVA: 'pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'uvedení do provozu',
  KONTROLA: 'kontrola',
}

/** Doplněk názvu pro termíny případu / zakázky / servisu */
export const DOPLNEK = {
  ZALOHA: 'očekáváme přijetí zálohy',
  REALIZACE: 'realizace',
  PREVZETI: 'předání díla',
  SERVIS: 'servisní návštěva',
  MONTAZ: 'montáž',
} as const

export function klientJmeno(k: { jmeno?: string | null; prijmeni?: string | null } | null | undefined): string {
  if (!k) return ''
  return [k.jmeno, k.prijmeni].filter(Boolean).join(' ').trim()
}

/** Složí název `Zákazník – Technologie – doplněk`, prázdné části vynechá. */
export function calendarTitle(klient: string, technologie: string, doplnek: string): string {
  return [klient, technologie, doplnek].map(s => s.trim()).filter(Boolean).join(' – ')
}

/** YYYY-MM-DD v UTC (termíny se ukládají jako UTC půlnoc daného dne) */
export function utcDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Rozsah od–do pro kalendář. `dateTo` se vyplní jen pokud konec leží
 * v jiném (pozdějším) dni než začátek.
 */
export function dateRange(od: Date, doo?: Date | null): { date: string; dateTo?: string } {
  const date = utcDateStr(od)
  if (!doo) return { date }
  const dateTo = utcDateStr(doo)
  return dateTo > date ? { date, dateTo } : { date }
}

export function fmtTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
