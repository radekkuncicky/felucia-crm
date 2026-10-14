import type { OdeslaniKanal, Prisma, QuoteStav } from '@prisma/client'

/**
 * Stav nabídky vůči klientovi (procesní mapa NANTO 4.1).
 *
 * ROZPRACOVANA → ODESLANA (odeslání e-mailem/SMS, nebo ručně „Označit jako odeslanou“)
 * ODESLANA → AKCEPTOVANA | ODMITNUTA (ručně; odmítnutí BEZ důvodu — důvod je povinný jen u prohraného OP)
 * AKCEPTOVANA | ODMITNUTA → ODESLANA (oprava omylu)
 *
 * Stav OP se tím neposouvá — UI ho po akceptaci jen nabídne.
 * Žádné automatické maily klientům; follow-up jede z přehledu „Visí odeslané“.
 */

export const QUOTE_STAVY = ['ROZPRACOVANA', 'ODESLANA', 'AKCEPTOVANA', 'ODMITNUTA'] as const satisfies readonly QuoteStav[]

export const QUOTE_STAV_LABEL: Record<QuoteStav, string> = {
  ROZPRACOVANA: 'Rozpracovaná',
  ODESLANA: 'Odeslaná',
  AKCEPTOVANA: 'Akceptovaná',
  ODMITNUTA: 'Odmítnutá',
}

/** Po kolika dnech ve stavu ODESLANA nabídka „visí“ (přehled + bell vlastníkovi OP) */
export const NABIDKA_VISI_PO_DNECH = 7

export function visiOdeslanaHranice(now = new Date()): Date {
  return new Date(now.getTime() - NABIDKA_VISI_PO_DNECH * 24 * 3600_000)
}

/** Povolené ruční přechody (odeslání e-mailem/SMS řeší dataOdeslani) */
const PRECHODY: Record<QuoteStav, QuoteStav[]> = {
  ROZPRACOVANA: ['ODESLANA'],
  ODESLANA: ['AKCEPTOVANA', 'ODMITNUTA'],
  AKCEPTOVANA: ['ODESLANA'],
  ODMITNUTA: ['ODESLANA'],
}

export function lzePrejit(z: QuoteStav, na: QuoteStav): boolean {
  return PRECHODY[z].includes(na)
}

/**
 * Data pro zápis odeslání (e-mail, SMS, ruční označení). Opakované odeslání
 * restartuje odpočet „visí“ i follow-up; akceptovaná/odmítnutá stav nemění.
 */
export function dataOdeslani(aktualni: QuoteStav, kanal: OdeslaniKanal | null, now = new Date()): Prisma.QuoteUpdateInput {
  const data: Prisma.QuoteUpdateInput = { odeslanoAt: now, odeslanoKanal: kanal, followUpAt: null }
  if (aktualni === 'ROZPRACOVANA' || aktualni === 'ODESLANA') {
    data.stav = 'ODESLANA'
    data.stavZmenen = now
  }
  return data
}

export function popisZmenyStavu(kod: string | null, na: QuoteStav): string {
  const n = `Nabídka${kod ? ` ${kod}` : ''}`
  switch (na) {
    case 'ODESLANA': return `${n} označena jako odeslaná`
    case 'AKCEPTOVANA': return `${n} akceptována klientem`
    case 'ODMITNUTA': return `${n} odmítnuta klientem`
    default: return `${n}: stav ${QUOTE_STAV_LABEL[na]}`
  }
}
