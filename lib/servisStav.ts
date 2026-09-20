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

// Typy servisní zakázky (NavstevaTyp) — sdílené popisky pro UI.
export type NavstevaTyp =
  | 'PLANOVANY_SERVIS'
  | 'PORUCHA'
  | 'ZARUCNI_OPRAVA'
  | 'POZARUCNI_OPRAVA'
  | 'UVEDENI_DO_PROVOZU'
  | 'KONTROLA'

export const TYP_LABELS: Record<NavstevaTyp, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

export function typLabel(typ: string): string {
  return TYP_LABELS[typ as NavstevaTyp] ?? typ
}

// Povolené přechody stavů (jeden zdroj pravdy — vynucuje servisZakazkaService,
// admin je může obejít force flagem). Vychází ze skutečných toků:
// dispečink (NOVA/CEKA→NAPLANOVANA, drag do poolu NAPLANOVANA→NOVA), technik
// (→PROBIHA→CEKA/DOKONCENA), kancelář (VYUCTOVANA→UZAVRENA). DOKONCENA→PROBIHA
// je záměrné znovuotevření (protokolDokoncen se nemaže). VYUCTOVANA nastavuje
// výhradně vyuctovat() mimo tento stroj. REKLAMACE je legacy stav — nové
// reklamace vznikají jako samostatná zakázka (puvodniZakazkaId).
export const SERVIS_STAV_PRECHODY: Record<ServisniZakazkaStav, ServisniZakazkaStav[]> = {
  NOVA: ['NAPLANOVANA', 'PROBIHA', 'ZRUSENA'],
  NAPLANOVANA: ['NOVA', 'PROBIHA', 'CEKA', 'ZRUSENA'],
  PROBIHA: ['NAPLANOVANA', 'CEKA', 'DOKONCENA', 'ZRUSENA'],
  CEKA: ['NAPLANOVANA', 'PROBIHA', 'ZRUSENA'],
  DOKONCENA: ['PROBIHA'],
  VYUCTOVANA: ['UZAVRENA'],
  UZAVRENA: [],
  ZRUSENA: ['NOVA'],
  REKLAMACE: ['NAPLANOVANA', 'PROBIHA', 'ZRUSENA'],
}

export function jePovolenyPrechod(z: string, na: string): boolean {
  return (SERVIS_STAV_PRECHODY[z as ServisniZakazkaStav] as string[] | undefined)?.includes(na) ?? false
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

// Priorita servisní akce (ServisPriorita). Urgentní = nahoře na nástěnce i v plánu.
export type ServisPriorita = 'BEZNA' | 'URGENTNI'

export const PRIORITA_LABELS: Record<ServisPriorita, string> = {
  BEZNA: 'Běžná',
  URGENTNI: 'Urgentní',
}

export function jeUrgentni(priorita: string | null | undefined): boolean {
  return priorita === 'URGENTNI'
}

// ---------------------------------------------------------------------------
// Pohledy nad zakázkami: „práce" vs. „budoucí návštěvy ze smluv".
//
// Kontrakty generují plánované návštěvy roky dopředu (na produ 75 z 78 zakázek
// je PLANOVANY_SERVIS s termínem 2027+). Ty nesmí zaplavit nástěnku ani
// výchozí seznam — reálná práce (porucha dnes) by se v nich ztratila.
// ---------------------------------------------------------------------------

/** Kolik dní dopředu se plánované kontraktní návštěvy ještě počítají za „aktuální". */
export const SERVIS_HORIZONT_DNI = 60

export type ServisPohledRow = {
  stav: string
  typ: string
  kontraktId?: string | null
  planovanyTermin: string | Date | null
}

/** Reaktivní = není to rutinní návštěva ze smlouvy (porucha, oprava, kontrola, nebo bez kontraktu). */
export function jeReaktivni(z: Pick<ServisPohledRow, 'typ' | 'kontraktId'>): boolean {
  return z.typ !== 'PLANOVANY_SERVIS' || !z.kontraktId
}

function dniDoTerminu(termin: string | Date | null, now: Date): number | null {
  if (!termin) return null
  return (new Date(termin).getTime() - now.getTime()) / 86_400_000
}

/**
 * Aktuální = aktivní stav a zároveň buď reaktivní, nebo bez termínu, nebo
 * termín do SERVIS_HORIZONT_DNI. Výchozí pohled seznamu.
 */
export function jeAktualni(z: ServisPohledRow, now: Date = new Date()): boolean {
  if (!jeAktivni(z.stav) && z.stav !== 'REKLAMACE') return false
  if (jeReaktivni(z)) return true
  const dni = dniDoTerminu(z.planovanyTermin, now)
  return dni === null || dni <= SERVIS_HORIZONT_DNI
}

/** Budoucí plánovaná návštěva ze smlouvy za horizontem — patří do pohledu „Plánované ze smluv". */
export function jeBudouciPlanovana(z: ServisPohledRow, now: Date = new Date()): boolean {
  if (z.stav !== 'NAPLANOVANA' || jeReaktivni(z)) return false
  const dni = dniDoTerminu(z.planovanyTermin, now)
  return dni !== null && dni > SERVIS_HORIZONT_DNI
}
