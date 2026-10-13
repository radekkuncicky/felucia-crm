import type { Permissions } from '@/lib/permissions'

/** Pole s nákupní cenou napříč modely (Product.nakladovaCena, *.nakupniCena) */
const NAKUPKY_KLICE = new Set(['nakupniCena', 'nakladovaCena'])

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (v === null || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

function strip(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(strip)
  if (!isPlainObject(v)) return v // Decimal, Date, primitivy beze změny
  const out: Record<string, unknown> = {}
  for (const [k, val] of Object.entries(v)) {
    out[k] = NAKUPKY_KLICE.has(k) ? null : strip(val)
  }
  return out
}

/**
 * Bez `financeNakupky` vynuluje nákupní ceny v odpovědi API, i ve vnořených
 * `include` (položky → product…). Použít na každou odpověď, která vrací
 * položky, produkty nebo skladové pohyby — i na odpovědi zápisů (POST/PATCH).
 */
export function maskNakupky<T>(data: T, perms: Pick<Permissions, 'financeNakupky'>): T {
  return perms.financeNakupky ? data : (strip(data) as T)
}
