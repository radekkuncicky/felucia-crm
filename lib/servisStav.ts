// Sdílené popisky a barvy stavů servisní zakázky (ServisniZakazkaStav).
// Jeden zdroj pravdy pro web UI, ať se mapy neduplikují po komponentách.

export type ServisniZakazkaStav =
  | 'NOVA'
  | 'NAPLANOVANA'
  | 'PROBIHA'
  | 'DOKONCENA'
  | 'VYUCTOVANA'
  | 'UZAVRENA'
  | 'CEKA'
  | 'ZRUSENA'
  | 'REKLAMACE'

export const SERVIS_STAV_LABELS: Record<ServisniZakazkaStav, string> = {
  NOVA: 'Nová',
  NAPLANOVANA: 'Naplánovaná',
  PROBIHA: 'Probíhá',
  DOKONCENA: 'Dokončená',
  VYUCTOVANA: 'Vyúčtovaná',
  UZAVRENA: 'Uzavřená',
  CEKA: 'Čeká',
  ZRUSENA: 'Zrušená',
  REKLAMACE: 'Reklamace',
}

export const SERVIS_STAV_COLORS: Record<ServisniZakazkaStav, string> = {
  NOVA: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  NAPLANOVANA: 'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  PROBIHA: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  DOKONCENA: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  VYUCTOVANA: 'bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300',
  UZAVRENA: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  CEKA: 'bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300',
  ZRUSENA: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
  REKLAMACE: 'bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300',
}

export function stavLabel(stav: string): string {
  return SERVIS_STAV_LABELS[stav as ServisniZakazkaStav] ?? stav
}

export function stavColor(stav: string): string {
  return SERVIS_STAV_COLORS[stav as ServisniZakazkaStav] ?? ''
}

// Akční stavy: zakázka ještě není uzavřená, dá se na ní pracovat / dokončit ji.
export const SERVIS_STAV_AKTIVNI: ServisniZakazkaStav[] = ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA']

export function jeAktivni(stav: string): boolean {
  return (SERVIS_STAV_AKTIVNI as string[]).includes(stav)
}

// Prošlá = naplánovaná, ale termín už je v minulosti (počítá se dynamicky, není to stav).
export function jeProsla(stav: string, planovanyTermin: string | Date | null): boolean {
  if (stav !== 'NAPLANOVANA' || !planovanyTermin) return false
  return new Date(planovanyTermin) < new Date()
}
