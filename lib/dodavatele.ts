import type { Prisma } from '@prisma/client'

/** Veřejný tvar dodavatele pro API/UI (Decimal → number, bez interních polí). */
export const DODAVATEL_SELECT = {
  id: true, nazev: true, ico: true, dic: true, email: true, telefon: true, kontaktOsoba: true,
  ulice: true, mesto: true, psc: true, poznamka: true, aktivni: true, vytvoreno: true,
} satisfies Prisma.DodavatelSelect

const TEXT_FIELDS = ['nazev', 'ico', 'dic', 'email', 'telefon', 'kontaktOsoba', 'ulice', 'mesto', 'psc', 'poznamka'] as const

/** Z těla requestu vybere textová pole dodavatele; prázdný řetězec → null. Chybí-li pole, nevrací ho (PATCH). */
export function dodavatelDataFromBody(body: Record<string, unknown>) {
  const data: Record<string, string | null | boolean> = {}
  for (const k of TEXT_FIELDS) {
    if (body[k] === undefined) continue
    const v = body[k]
    data[k] = typeof v === 'string' && v.trim() ? v.trim() : null
  }
  if (typeof body.aktivni === 'boolean') data.aktivni = body.aktivni
  return data
}

export function validateDodavatel(data: Record<string, unknown>, requireNazev: boolean) {
  if (requireNazev && !data.nazev) return 'Název dodavatele je povinný'
  if ('nazev' in data && data.nazev === null) return 'Název dodavatele je povinný'
  if (typeof data.email === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return 'Neplatný e-mail'
  return null
}

export function adresaDodavatele(d: { ulice: string | null; mesto: string | null; psc: string | null }) {
  const radek2 = [d.psc, d.mesto].filter(Boolean).join(' ')
  return [d.ulice, radek2].filter(Boolean).join(', ')
}
