/**
 * Hodnota pole zdroje poptávky + kdo doporučil (lead, OP, zápis hovoru) — sdílí
 * klientská komponenta i serverové stránky. Kód DOPORUCENI zapíná „kdo doporučil“.
 */
export interface ZdrojHodnota {
  zdrojPoptavkyId: string
  doporucilKlientId: string
  /** Text v poli „kdo doporučil“ — jméno vybraného klienta, nebo volný text */
  doporucilNazev: string
}

export const PRAZDNY_ZDROJ: ZdrojHodnota = { zdrojPoptavkyId: '', doporucilKlientId: '', doporucilNazev: '' }

export interface ZdrojVolba { id: string; kod: string; nazev: string; aktivni: boolean }

/** Tělo pro API (parseZdroj): vybraný klient má přednost před volným textem. */
export function zdrojPayload(v: ZdrojHodnota) {
  return {
    zdrojPoptavkyId: v.zdrojPoptavkyId || null,
    doporucilKlientId: v.doporucilKlientId || null,
    doporucilText: v.doporucilKlientId ? null : v.doporucilNazev.trim() || null,
  }
}

export function zdrojHodnota(src: {
  zdrojPoptavkyId?: string | null
  doporucilKlientId?: string | null
  doporucilText?: string | null
  doporucilKlient?: { jmeno: string; prijmeni: string } | null
}): ZdrojHodnota {
  return {
    zdrojPoptavkyId: src.zdrojPoptavkyId ?? '',
    doporucilKlientId: src.doporucilKlientId ?? '',
    doporucilNazev: src.doporucilKlient
      ? `${src.doporucilKlient.jmeno} ${src.doporucilKlient.prijmeni}`.trim()
      : src.doporucilText ?? '',
  }
}
