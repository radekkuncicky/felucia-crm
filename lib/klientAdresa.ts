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

/** Adresa klienta jako jeden řádek „Ulice 1, 602 00 Brno“ (sídlo / bydliště do smlouvy). */
export function adresaKlientaText(k: { ulice?: string | null; mesto?: string | null; psc?: string | null }): string {
  return [txt(k.ulice), [txt(k.psc), txt(k.mesto)].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

/**
 * Jednořádková adresa → pole klienta (ulice / psc / mesto). Best-effort:
 * PSČ se najde podle pěti číslic, „Česko/Česká republika“ se zahodí,
 * první část je ulice, zbytek obec. Bez rozpoznatelné obce vrací null.
 */
export function rozlozAdresu(text: string | null | undefined): { ulice: string | null; mesto: string; psc: string | null } | null {
  const casti = txt(text).split(',').map((c) => c.trim()).filter(Boolean)
    .filter((c) => !/^(česko|česká republika|czech republic|cz)$/i.test(c))
  if (casti.length === 0) return null
  let psc: string | null = null
  const bezPsc = casti.map((c) => {
    const m = c.match(/\b(\d{3})\s?(\d{2})\b/)
    if (!m || psc) return c
    psc = `${m[1]} ${m[2]}`
    return c.replace(m[0], '').replace(/\s+/g, ' ').trim()
  }).filter(Boolean)
  if (bezPsc.length === 0) return null
  if (bezPsc.length === 1) return { ulice: null, mesto: bezPsc[0], psc }
  return { ulice: bezPsc[0], mesto: bezPsc.slice(1).join(', '), psc }
}
