// Stav smlouvy o dílo pro hlavičku zakázky: odvozený z SOD navázaných přes OP
// (Sod.dealId = Zakazka.opId) + ruční příznak papírového podpisu na zakázce.

export type SodStavZakazkyKod = 'PODEPSANA' | 'PODEPSANA_PAPIROVE' | 'ODESLANA' | 'NEODESLANA' | 'BEZ_SOD'

export interface SodProStav {
  id: string
  cislo: string
  stav: string
  podepsano: Date | null
  vytvoreno: Date
}

export interface SodStavZakazky {
  kod: SodStavZakazkyKod
  label: string
  /** SOD, ke které se stav vztahuje (odkaz / číslo) */
  sod: { id: string; cislo: string } | null
  datum: Date | null
}

export const SOD_STAV_ZAKAZKY_LABELS: Record<SodStavZakazkyKod, string> = {
  PODEPSANA: 'Podepsaná klientem',
  PODEPSANA_PAPIROVE: 'Podepsaná (papírově)',
  ODESLANA: 'Odeslaná',
  NEODESLANA: 'Neodeslaná',
  BEZ_SOD: 'Bez SOD',
}

const IGNOROVANE = new Set(['STORNO', 'EXPIROVANO'])

export function sodStavZakazky(sody: SodProStav[], papirove: Date | null): SodStavZakazky {
  const platne = sody
    .filter((s) => !IGNOROVANE.has(s.stav))
    .sort((a, b) => b.vytvoreno.getTime() - a.vytvoreno.getTime())
  const ref = (s: SodProStav | undefined) => (s ? { id: s.id, cislo: s.cislo } : null)
  const vysledek = (kod: SodStavZakazkyKod, s: SodProStav | undefined, datum: Date | null): SodStavZakazky =>
    ({ kod, label: SOD_STAV_ZAKAZKY_LABELS[kod], sod: ref(s), datum })

  const podepsana = platne.find((s) => s.stav === 'PODEPSANO')
  if (podepsana) return vysledek('PODEPSANA', podepsana, podepsana.podepsano)
  if (papirove) return vysledek('PODEPSANA_PAPIROVE', platne[0], papirove)
  const odeslana = platne.find((s) => s.stav === 'ODESLANO')
  if (odeslana) return vysledek('ODESLANA', odeslana, null)
  if (platne[0]) return vysledek('NEODESLANA', platne[0], null)
  return vysledek('BEZ_SOD', undefined, null)
}
