import { zamereniFotoTagLabels } from './constants'

/**
 * Štítky fotek k OP (appka Sales). Ukládá se KLÍČ (Photo.tag), název se
 * dohledává — přejmenování štítku v nastavení nerozbije staré fotky.
 * Firma si sadu může přepsat v OrgSettings.fotoStitky.
 */
export interface FotoStitek {
  klic: string
  nazev: string
}

export const VYCHOZI_FOTO_STITKY: FotoStitek[] = [
  { klic: 'DUM_ZVENKU', nazev: 'Dům zvenku' },
  { klic: 'MISTO_VJ', nazev: 'Místo VJ' },
  { klic: 'MISTO_JJ', nazev: 'Místo JJ' },
  { klic: 'TRASA_POTRUBI', nazev: 'Trasa potrubí' },
  { klic: 'ROZVADEC', nazev: 'Rozvaděč' },
  { klic: 'KOTELNA', nazev: 'Kotelna / stávající zdroj' },
  { klic: 'STITEK_KOTLE', nazev: 'Štítek stávajícího kotle' },
  { klic: 'JINE', nazev: 'Jiné' },
]

/** Klíč, podle kterého se vybírá titulní fotka OP */
export const TITULNI_STITEK = 'DUM_ZVENKU'

const KLIC_RE = /^[A-Z0-9_]{1,40}$/

/** Sada štítků firmy (z OrgSettings.fotoStitky), jinak výchozí */
export function fotoStitkyOrg(raw: unknown): FotoStitek[] {
  if (!Array.isArray(raw)) return VYCHOZI_FOTO_STITKY
  const out = raw
    .filter((s): s is FotoStitek =>
      !!s && typeof s === 'object'
      && typeof (s as FotoStitek).klic === 'string' && KLIC_RE.test((s as FotoStitek).klic)
      && typeof (s as FotoStitek).nazev === 'string' && (s as FotoStitek).nazev.trim().length > 0)
    .map(s => ({ klic: s.klic, nazev: s.nazev.trim().slice(0, 60) }))
  return out.length > 0 ? out : VYCHOZI_FOTO_STITKY
}

/** Platný klíč štítku (tvar), jinak null — neznámý klíč se ukládá taky (sada se může změnit) */
export function parseStitek(v: unknown): string | null {
  return typeof v === 'string' && KLIC_RE.test(v) ? v : null
}

/** Název štítku pro zobrazení (štítky OP i tagy zaměření) */
export function nazevStitku(klic: string | null | undefined, stitky: FotoStitek[] = VYCHOZI_FOTO_STITKY): string | null {
  if (!klic) return null
  return stitky.find(s => s.klic === klic)?.nazev
    ?? VYCHOZI_FOTO_STITKY.find(s => s.klic === klic)?.nazev
    ?? zamereniFotoTagLabels[klic]
    ?? klic
}
