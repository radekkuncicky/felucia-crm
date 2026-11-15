/**
 * Skládání iCalendar (RFC 5545) pro ICS feed.
 *
 * Události s časem jedou v pražském místním čase (`TZID=Europe/Prague` + VTIMEZONE),
 * takže schůzka na 14:30 je v iPhonu/Googlu 14:30 v zimě i v létě. Bez času
 * zůstávají celodenní (`VALUE=DATE`).
 */

export const ICS_TZID = 'Europe/Prague'

/** VTIMEZONE pro Europe/Prague (SEČ/SELČ podle pravidel EU od 1996) */
export const VTIMEZONE_PRAHA = [
  'BEGIN:VTIMEZONE',
  `TZID:${ICS_TZID}`,
  'BEGIN:DAYLIGHT',
  'TZOFFSETFROM:+0100',
  'TZOFFSETTO:+0200',
  'TZNAME:CEST',
  'DTSTART:19700329T020000',
  'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU',
  'END:DAYLIGHT',
  'BEGIN:STANDARD',
  'TZOFFSETFROM:+0200',
  'TZOFFSETTO:+0100',
  'TZNAME:CET',
  'DTSTART:19701025T030000',
  'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU',
  'END:STANDARD',
  'END:VTIMEZONE',
].join('\r\n')

export function escapeIcal(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/**
 * Zalomení řádku po 75 oktetech (RFC 5545 3.1). Počítá bajty UTF-8, ne znaky —
 * čeština s diakritikou by jinak přetekla — a nikdy nerozdělí vícebajtový znak.
 */
export function foldLine(line: string): string {
  const enc = new TextEncoder()
  if (enc.encode(line).length <= 75) return line
  const parts: string[] = []
  let cur = ''
  let curBytes = 0
  let limit = 75
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (curBytes + b > limit) {
      parts.push(cur)
      cur = ''
      curBytes = 0
      limit = 74 // pokračovací řádek začíná mezerou
    }
    cur += ch
    curBytes += b
  }
  parts.push(cur)
  return parts.join('\r\n ')
}

const ymdCompact = (ymd: string) => ymd.replace(/-/g, '')

/** „YYYY-MM-DD“ + n dní */
function plusDny(ymd: string, n: number): string {
  const d = new Date(`${ymd}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}

/** Platný čas „HH:MM“ (0–23 : 0–59), jinak null */
export function parseHHMM(cas: string | null | undefined): { h: number; m: number } | null {
  const mt = /^(\d{1,2}):(\d{2})$/.exec(cas ?? '')
  if (!mt) return null
  const h = Number(mt[1])
  const m = Number(mt[2])
  if (h > 23 || m > 59) return null
  return { h, m }
}

/**
 * Místní začátek a konec (pražský „nástěnný“ čas, bez převodu do UTC).
 * Konec = začátek + trvání; přes půlnoc se posune den.
 */
export function mistniRozsah(ymd: string, cas: string, trvaniMin: number): { start: string; end: string } | null {
  const t = parseHHMM(cas)
  if (!t) return null
  const fmt = (dayYmd: string, mins: number) => {
    const extraDny = Math.floor(mins / 1440)
    const zb = mins - extraDny * 1440
    const hh = String(Math.floor(zb / 60)).padStart(2, '0')
    const mm = String(zb % 60).padStart(2, '0')
    return `${ymdCompact(plusDny(dayYmd, extraDny))}T${hh}${mm}00`
  }
  const startMin = t.h * 60 + t.m
  const dur = Math.max(5, Math.min(trvaniMin, 24 * 60))
  return { start: fmt(ymd, startMin), end: fmt(ymd, startMin + dur) }
}

/** DTSTAMP ve tvaru 20261115T120000Z */
export function icsStamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export type IcsEvent = {
  uid: string
  /** den začátku „YYYY-MM-DD“ */
  date: string
  /** poslední den (včetně) u vícedenních celodenních akcí */
  dateTo?: string
  /** „HH:MM“ → událost s časem v pražském čase */
  cas?: string | null
  /** délka v minutách (jen s `cas`) */
  trvaniMin?: number | null
  summary: string
  description: string
  url: string
  location?: string
}

export function vevent(e: IcsEvent, stamp: string): string {
  const lines = [
    'BEGIN:VEVENT',
    foldLine(`UID:${e.uid}@felucia`),
    `DTSTAMP:${stamp}`,
  ]
  const r = e.cas ? mistniRozsah(e.date, e.cas, e.trvaniMin ?? 60) : null
  if (r) {
    lines.push(`DTSTART;TZID=${ICS_TZID}:${r.start}`, `DTEND;TZID=${ICS_TZID}:${r.end}`)
  } else {
    // DTEND je v iCal exkluzivní → den po posledním dni
    const konec = e.dateTo && e.dateTo > e.date ? e.dateTo : e.date
    lines.push(`DTSTART;VALUE=DATE:${ymdCompact(e.date)}`, `DTEND;VALUE=DATE:${ymdCompact(plusDny(konec, 1))}`)
  }
  lines.push(
    foldLine(`SUMMARY:${escapeIcal(e.summary)}`),
    foldLine(`DESCRIPTION:${escapeIcal(e.description)}`),
    foldLine(`URL:${e.url}`),
  )
  if (e.location) lines.push(foldLine(`LOCATION:${escapeIcal(e.location)}`))
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

export function vcalendar(nazev: string, events: string[]): string {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Felucia CRM//CS',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${escapeIcal(nazev)}`),
    `X-WR-TIMEZONE:${ICS_TZID}`,
    VTIMEZONE_PRAHA,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n') + '\r\n'
}
