// DOČASNÝ kompatibilní shim pro mobilní app felucia-tech.
// App zná staré stavy (ServisStav) a pole cisloNavstevy. Než se app upraví,
// staré endpointy (/api/servis/navstevy, /upcoming, /stats) musí vracet starý
// tvar. AŽ se app přepíše na ServisniZakazka, celý tento soubor SMAZAT.
// TODO(servis-refactor): odstranit po nasazení nové app.

// Nový stav -> starý název, který app očekává.
const NEW_TO_LEGACY: Record<string, string> = {
  NOVA: 'PLANOVANA',
  NAPLANOVANA: 'PLANOVANA',
  PROBIHA: 'PROBIHA',
  DOKONCENA: 'DOKONCENA',
  VYUCTOVANA: 'DOKONCENA',
  UZAVRENA: 'DOKONCENA',
  CEKA: 'PLANOVANA',
  ZRUSENA: 'ZRUSENA',
  REKLAMACE: 'PROBIHA',
}

// Starý stav (vstup z app) -> nový. Nové hodnoty propustí beze změny.
const LEGACY_TO_NEW: Record<string, string> = {
  PLANOVANA: 'NAPLANOVANA',
  POTVRZENA: 'NAPLANOVANA',
  PROBIHA: 'PROBIHA',
  DOKONCENA: 'DOKONCENA',
  ZRUSENA: 'ZRUSENA',
  PRESLA: 'NAPLANOVANA',
}

const NEW_STAVY = new Set([
  'NOVA', 'NAPLANOVANA', 'PROBIHA', 'DOKONCENA',
  'VYUCTOVANA', 'UZAVRENA', 'CEKA', 'ZRUSENA', 'REKLAMACE',
])

export function legacyStav(stav: string): string {
  return NEW_TO_LEGACY[stav] ?? stav
}

// Pro filtr přijatý od app (?stav=PLANOVANA). Vrací nový stav, nebo null pokud nezná.
export function legacyStavToNew(stav: string): string | null {
  if (NEW_STAVY.has(stav)) return stav
  return LEGACY_TO_NEW[stav] ?? null
}

// Zabalí servisní zakázku do tvaru, který app zná (starý stav + cisloNavstevy).
export function toLegacyNavsteva<T extends { stav: string; cislo: string | null }>(z: T) {
  return { ...z, stav: legacyStav(z.stav), cisloNavstevy: z.cislo }
}
