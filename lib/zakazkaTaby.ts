// Taby detailu zakázky (D1): 6 tabů místo 9. Staré klíče z odkazů v e-mailech,
// notifikacích a appce (?tab=predavaky …) se přesměrují na nový tab + kotvu sekce.

export type ZakazkaTab = 'polozky' | 'ukoly' | 'kontakty' | 'protokoly' | 'podklady' | 'historie'

export const ZAKAZKA_TABY: { key: ZakazkaTab; label: string }[] = [
  { key: 'polozky', label: 'Položky' },
  { key: 'ukoly', label: 'Úkoly' },
  { key: 'kontakty', label: 'Kontakty' },
  { key: 'protokoly', label: 'Protokoly a vyúčtování' },
  { key: 'podklady', label: 'Podklady a foto' },
  { key: 'historie', label: 'Historie' },
]

/** Starý klíč → nový tab a id sekce, na kterou se odroluje */
export const ZAKAZKA_TAB_ALIASY: Record<string, { tab: ZakazkaTab; kotva: string }> = {
  objednavky: { tab: 'polozky', kotva: 'objednavky' },
  predavaky: { tab: 'protokoly', kotva: 'predavaky' },
  vyuctovani: { tab: 'protokoly', kotva: 'vyuctovani' },
  foto: { tab: 'podklady', kotva: 'foto' },
  technici: { tab: 'polozky', kotva: '' },
}

const PLATNE = new Set<string>(ZAKAZKA_TABY.map(t => t.key))

/** Technik (bez obchodu) začíná na protokolech, kancelář na položkách */
export function vychoziZakazkaTab(technickyPohled: boolean): ZakazkaTab {
  return technickyPohled ? 'protokoly' : 'polozky'
}

/**
 * Z ?tab= určí tab. `presmerovat` je vyplněné u starého klíče (stránka udělá redirect,
 * aby URL i kotva odpovídaly), neznámý klíč spadne na výchozí tab.
 */
export function resolveZakazkaTab(raw: string | undefined, vychozi: ZakazkaTab): {
  tab: ZakazkaTab
  presmerovat: { tab: ZakazkaTab; kotva: string } | null
} {
  if (!raw) return { tab: vychozi, presmerovat: null }
  if (PLATNE.has(raw)) return { tab: raw as ZakazkaTab, presmerovat: null }
  const alias = ZAKAZKA_TAB_ALIASY[raw]
  if (alias) return { tab: alias.tab, presmerovat: alias }
  return { tab: vychozi, presmerovat: null }
}

/** Aktivní tab podle cesty (podstránky předáváku / vyúčtování / objednávky) */
export function zakazkaTabZCesty(pathname: string): ZakazkaTab | null {
  if (pathname.includes('/vyuctovani/') || pathname.includes('/predavaky/')) return 'protokoly'
  if (pathname.includes('/objednavky/')) return 'polozky'
  return null
}
