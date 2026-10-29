import { formatPsc } from './ares'

export interface AdresaVstup {
  ulice?: unknown
  cislo?: unknown
  obec?: unknown
  castObce?: unknown
  psc?: unknown
}

const txt = (v: unknown) => (v === undefined || v === null ? '' : String(v).trim())

/**
 * Adresa po částech → pole klienta stejně jako z ARES (lib/ares.ts buildUlice):
 * ulice = „Ulice číslo“ (obec bez ulic → část obce), mesto = obec. Vrací jen
 * pole, ke kterým přišla data — částečná změna (jen PSČ) nesmaže ostatní.
 */
export function slozAdresu(a: AdresaVstup): { ulice?: string | null; mesto?: string | null; psc?: string | null } | string {
  const ulice = txt(a.ulice), cislo = txt(a.cislo), obec = txt(a.obec), cast = txt(a.castObce), psc = txt(a.psc)
  const out: { ulice?: string | null; mesto?: string | null; psc?: string | null } = {}
  if (ulice || cislo || cast) {
    const nazev = ulice || cast
    if (!nazev) return 'K číslu domu uveď ulici, nebo část obce u obce bez ulic'
    out.ulice = [nazev, cislo].filter(Boolean).join(' ')
  }
  if (obec) out.mesto = obec
  if (psc) {
    if (!/^\d{3}\s?\d{2}$/.test(psc)) return 'PSČ má pět číslic'
    out.psc = formatPsc(psc)
  }
  return out
}
