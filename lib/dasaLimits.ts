// Limity AI asistentky Dáši podle plánu - jediný zdroj pravdy pro vynucení
// (app/api/ai-assistant), nastavení fakturace i veřejný web (lib/landing.ts).
// Čistá data bez závislostí na serveru, ať je může importovat i klientský kód.
//
// Jednotka je KREDIT, ne dotaz: jeden dotaz stojí podle náročnosti odpovědi
// (počet tokenů, volání nástrojů) několik kreditů - viz dasaKredity(). Prod 2026-10:
// medián 4, 90 % dotazů do 15 kreditů.

export type DasaPlan = 'STARTER' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE'

/** Měsíční limit kreditů; 0 = Dáša není v plánu, Infinity = bez limitu. */
export const DASA_KREDITY_MESICNE: Record<DasaPlan, number> = {
  STARTER: 0,
  STANDARD: 200,
  PROFESSIONAL: 1000,
  ENTERPRISE: Infinity,
}

/** Plány, ve kterých je Dáša dostupná (v pořadí od nejnižšího). */
export const DASA_PLANY = (Object.keys(DASA_KREDITY_MESICNE) as DasaPlan[]).filter(p => DASA_KREDITY_MESICNE[p] > 0)

/**
 * Kolik kreditů stojí jeden dotaz: efektivní tokeny / 1000, zaokrouhleno nahoru, minimálně 1.
 * Efektivní tokeny = nové vstupní tokeny + 10 % tokenů z cache + 5x výstupní tokeny
 * (výstup je u poskytovatele 5x dražší než vstup, čtení z cache skoro zdarma).
 */
export function dasaKredity(inputTokens: number, outputTokens: number, cacheReadTokens: number): number {
  const effective = (inputTokens - cacheReadTokens) + cacheReadTokens * 0.1 + outputTokens * 5
  return Math.max(1, Math.ceil(effective / 1000))
}

function nazevPlanu(plan: DasaPlan): string {
  return plan.charAt(0) + plan.slice(1).toLowerCase()
}

/** "200 kreditů měsíčně" / "bez limitu" / "není v plánu" */
export function formatDasaLimit(plan: DasaPlan): string {
  const limit = DASA_KREDITY_MESICNE[plan]
  if (limit === 0) return 'není v plánu'
  if (limit === Infinity) return 'bez limitu'
  return `${new Intl.NumberFormat('cs-CZ').format(limit)} kreditů měsíčně`
}

/** "Standard, Professional a Enterprise" */
export function formatDasaPlany(): string {
  const nazvy = DASA_PLANY.map(nazevPlanu)
  return nazvy.length > 1 ? `${nazvy.slice(0, -1).join(', ')} a ${nazvy[nazvy.length - 1]}` : nazvy[0]
}

/** "Dostupná v plánech Standard (200 kreditů měsíčně), Professional (...) a Enterprise (bez limitu)" */
export function formatDasaDostupnost(): string {
  const casti = DASA_PLANY.map(p => `${nazevPlanu(p)} (${formatDasaLimit(p)})`)
  const seznam = casti.length > 1 ? `${casti.slice(0, -1).join(', ')} a ${casti[casti.length - 1]}` : casti[0]
  return `Dostupná v plánech ${seznam}`
}
