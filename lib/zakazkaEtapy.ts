// Etapy zakázky jdou striktně lineárně za sebou — každá etapa má sadu kroků
// Etapa N -> Montáž N -> Předávka N -> Vyúčtování N. Další etapu lze
// otevřít, až je ta předchozí kompletně vyúčtovaná. Sdíleno mezi API gatingem,
// PipelineBar (stavová lišta) a přehledem zakázek (sloupec "Aktuální fáze").

export type EtapaKrok = 'MONTAZ' | 'PREDAVKA' | 'VYUCTOVANI'

export interface EtapaProgressInput {
  cislo: number
  nazev: string | null
  stav: string
  predavaky: { stav: string }[]
  vyuctovani: { stav: string }[]
}

export interface EtapaProgress {
  cislo: number
  nazev: string | null
  montazDone: boolean
  predavkaDone: boolean
  vyuctovaniDone: boolean
}

export function etapaProgressFromRaw(e: EtapaProgressInput): EtapaProgress {
  return {
    cislo: e.cislo,
    nazev: e.nazev,
    // Montáž se v ZakazkaEtapa netrackuje samostatným polem — jakmile existuje
    // protokol nebo je etapa manuálně označená jako PREDANA, montáž musela proběhnout.
    montazDone: e.stav === 'PREDANA' || e.predavaky.length > 0,
    predavkaDone: e.predavaky.some(p => p.stav === 'SCHVALEN'),
    vyuctovaniDone: e.vyuctovani.some(v => v.stav === 'SCHVALENO'),
  }
}

export function etapaKompletni(e: EtapaProgress): boolean {
  return e.montazDone && e.predavkaDone && e.vyuctovaniDone
}

/** První nedokončený krok etapy; null = etapa je kompletně vyúčtovaná. */
export function aktualniKrokEtapy(e: EtapaProgress): EtapaKrok | null {
  if (!e.montazDone) return 'MONTAZ'
  if (!e.predavkaDone) return 'PREDAVKA'
  if (!e.vyuctovaniDone) return 'VYUCTOVANI'
  return null
}

const KROK_LABEL: Record<EtapaKrok, string> = {
  MONTAZ: 'Montáž',
  PREDAVKA: 'Předávka',
  VYUCTOVANI: 'Vyúčtování',
}

const KROK_LABEL_HOTOVO: Record<EtapaKrok, string> = {
  MONTAZ: 'Montováno',
  PREDAVKA: 'Předáno',
  VYUCTOVANI: 'Vyúčtováno',
}

/** Popisek pro sloupec "Aktuální fáze" v přehledu zakázek, např. "Montáž 2E". */
export function aktualniFazeLabel(etapy: EtapaProgress[]): string | null {
  if (etapy.length === 0) return null
  const posledni = etapy[etapy.length - 1]
  const krok = aktualniKrokEtapy(posledni)
  if (!krok) return `Vyúčtováno ${posledni.cislo}E`
  return `${KROK_LABEL[krok]} ${posledni.cislo}`
}

/** Lze přidat další etapu, jen když ta poslední existující je kompletně vyúčtovaná (nebo žádná ještě není). */
export function lzePridatDalsiEtapu(etapy: EtapaProgress[]): boolean {
  if (etapy.length === 0) return true
  return etapaKompletni(etapy[etapy.length - 1])
}

export { KROK_LABEL, KROK_LABEL_HOTOVO }
