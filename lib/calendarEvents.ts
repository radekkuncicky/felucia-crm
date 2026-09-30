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

/** Krátký štítek technologie do úzkých buněk kalendáře */
export const TECH_SHORT: Record<string, string> = {
  KLIMA: 'Klima',
  TEPELNE_CERPADLO: 'TČ',
  REKUPERACE: 'Rekup.',
  PODLAHOVE_TOPENI: 'Podl. top.',
  VZDUCHOTECHNIKA: 'VZT',
  JINE: 'Jiné',
}

/** Typ servisovaného zařízení → technologie (kvůli jednotným barvám v kalendáři) */
const ZARIZENI_TYP_TECH: Record<string, string> = {
  KLIMATIZACE: 'KLIMA',
  TEPELNE_CERPADLO: 'TEPELNE_CERPADLO',
  REKUPERACE: 'REKUPERACE',
  PODLAHOVE_VYTAPENI: 'PODLAHOVE_TOPENI',
  VZDUCHOTECHNIKA: 'VZDUCHOTECHNIKA',
}

export function zarizeniTech(zarizeni: { typ?: string | null } | null | undefined): string | undefined {
  if (!zarizeni?.typ) return undefined
  return ZARIZENI_TYP_TECH[zarizeni.typ] ?? 'JINE'
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

/**
 * Jméno klienta do kalendáře. U firmy je v `jmeno` název firmy a v `prijmeni`
 * kontaktní osoba — ukazujeme jen firmu.
 */
export function klientJmeno(k: { jmeno?: string | null; prijmeni?: string | null; typKlienta?: string | null } | null | undefined): string {
  if (!k) return ''
  if (k.typKlienta === 'FIRMA') return (k.jmeno ?? '').trim()
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

/** Posune den YYYY-MM-DD o n dní (počítáno v UTC, bez vlivu letního času). */
export function addDaysStr(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

/** Rozdíl dnů b − a (YYYY-MM-DD). */
export function diffDays(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000)
}

/** Posun rozsahu od–do o `delta` dní se zachováním délky (přetažení v kalendáři). */
export function shiftRange(date: string, dateTo: string | undefined, delta: number): { date: string; dateTo?: string } {
  return {
    date: addDaysStr(date, delta),
    ...(dateTo ? { dateTo: addDaysStr(dateTo, delta) } : {}),
  }
}
