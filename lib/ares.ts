/**
 * ARES lookup (ares.gov.cz) — sdílené mezi webem (/api/ares) a mobilním
 * obchodním API (/api/mobile/obchod/ares). Chyby a timeouty se polykají,
 * vrací se prázdný seznam — předvyplnění je best-effort.
 */

const ARES_BASE = 'https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty'
const TIMEOUT_MS = 5000

export interface AresFirma {
  ico: string
  nazev: string
  dic: string | null
  ulice: string
  mesto: string
  psc: string
  pravniForma: string
}

/**
 * Doplní z ARES jen pole, která jsou ve formuláři prázdná — co uživatel napsal
 * ručně, zůstává. `mapa` říká, které pole formuláře bere kterou hodnotu z AresFirma.
 * Čistá funkce, bezpečná i na klientu.
 */
export function doplnZAres<T extends object>(
  form: T,
  firma: AresFirma,
  mapa: Partial<Record<keyof T, keyof AresFirma>>,
): T {
  const next = { ...form } as Record<string, unknown>
  for (const [pole, zdroj] of Object.entries(mapa) as [string, keyof AresFirma][]) {
    const soucasna = (form as Record<string, unknown>)[pole]
    const nova = firma[zdroj]
    if ((typeof soucasna === 'string' && soucasna.trim() === '') || soucasna == null) {
      if (nova !== null && nova !== undefined && nova !== '') next[pole] = nova
    }
  }
  return next as T
}

export function formatPsc(raw: string | number | null | undefined): string {
  if (!raw) return ''
  const s = String(raw).replace(/\s/g, '')
  return s.length === 5 ? `${s.slice(0, 3)} ${s.slice(3)}` : s
}

export function buildUlice(sidlo: Record<string, unknown>): string {
  // Obce bez ulic (vesnice) mají v ARES jen část obce → použije se jako „ulice"
  const ulice = (sidlo.nazevUlice as string | undefined) ?? (sidlo.nazevCastiObce as string | undefined)
  const domovni = sidlo.cisloDomovni as string | number | undefined
  const orientacni = sidlo.cisloOrientacni as string | number | undefined
  const pismeno = (sidlo.cisloOrientacniPismeno as string | undefined) ?? ''
  if (!ulice && !domovni) return ''
  const cislo = orientacni ? `${domovni}/${orientacni}${pismeno}` : domovni ? String(domovni) : ''
  return [ulice, cislo].filter(Boolean).join(' ')
}

export function mapSubjekt(data: Record<string, unknown>): AresFirma {
  const sidlo = (data.sidlo as Record<string, unknown>) ?? {}
  return {
    ico: String(data.ico ?? ''),
    nazev: String(data.obchodniJmeno ?? ''),
    dic: (data.dic as string | null) ?? null,
    ulice: buildUlice(sidlo),
    mesto: String(sidlo.nazevObce ?? ''),
    psc: formatPsc(sidlo.psc as string | number | null | undefined),
    pravniForma: String(data.pravniForma ?? ''),
  }
}

/** IČO (jen číslice) → přímý lookup; jinak fulltext podle obchodního jména. */
export async function aresLookup(q: string): Promise<AresFirma[]> {
  const query = q.trim()
  if (query.length < 2) return []

  const isIco = /^\d+$/.test(query)
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let firmy: AresFirma[] = []
    if (isIco) {
      const res = await fetch(`${ARES_BASE}/${encodeURIComponent(query)}`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      })
      if (res.ok) {
        const data = await res.json() as Record<string, unknown>
        firmy = [mapSubjekt(data)]
      }
    } else {
      const res = await fetch(`${ARES_BASE}/vyhledat`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ obchodniJmeno: query, pocet: 10 }),
      })
      if (res.ok) {
        const data = await res.json() as { ekonomickeSubjekty?: Record<string, unknown>[] }
        firmy = (data.ekonomickeSubjekty ?? []).map(mapSubjekt)
      }
    }

    clearTimeout(timer)
    return firmy
  } catch {
    return []
  }
}
