// Úkolník zakázky — interní checklist realizace (objednat jednotku, domluvit
// elektrikáře, poslat zálohovku…). Neplést s Activity = kontakt s klientem na OP.

export type UkolData = {
  text: string
  poznamka: string | null
  termin: Date | null
  resitelId: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Datum přijmeme jako ISO string nebo YYYY-MM-DD; prázdné = bez termínu. */
function parseTermin(v: unknown): Date | null | 'invalid' {
  if (v === null || v === undefined || v === '') return null
  if (typeof v !== 'string') return 'invalid'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? 'invalid' : d
}

/** Validace vstupu úkolu; pro PATCH povolí částečný update (jen zadaná pole). */
export function parseUkolInput(body: unknown): { data: UkolData } | { error: string }
export function parseUkolInput(body: unknown, opts: { partial: true }): { data: Partial<UkolData> } | { error: string }
export function parseUkolInput(body: unknown, opts: { partial?: boolean } = {}):
  { data: Partial<UkolData> } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>
  const data: Partial<UkolData> = {}

  if (!opts.partial || 'text' in b) {
    const text = str(b.text)
    if (!text) return { error: 'Text úkolu je povinný' }
    if (text.length > 500) return { error: 'Text úkolu je příliš dlouhý' }
    data.text = text
  }
  if (!opts.partial || 'poznamka' in b) {
    const poznamka = str(b.poznamka)
    if (poznamka.length > 2000) return { error: 'Poznámka je příliš dlouhá' }
    data.poznamka = poznamka || null
  }
  if (!opts.partial || 'termin' in b) {
    const termin = parseTermin(b.termin)
    if (termin === 'invalid') return { error: 'Neplatný termín' }
    data.termin = termin
  }
  if (!opts.partial || 'resitelId' in b) {
    const resitelId = str(b.resitelId)
    data.resitelId = resitelId || null
  }
  return { data }
}

/** Řazení: nehotové před hotovými, pak podle pořadí a data vytvoření. */
export const UKOL_ORDER_BY = [
  { hotovo: 'asc' as const },
  { poradi: 'asc' as const },
  { vytvoreno: 'asc' as const },
]

export const UKOL_SELECT = {
  id: true,
  text: true,
  poznamka: true,
  termin: true,
  hotovo: true,
  hotovoAt: true,
  poradi: true,
  resitelId: true,
  resitel: { select: { id: true, jmeno: true } },
} as const
