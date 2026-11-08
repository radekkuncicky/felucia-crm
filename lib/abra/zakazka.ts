/**
 * F2: založení zakázky Felucie ve Flexi (evidence `zakazka`) i s odběratelem.
 *
 * Pravidla od NANTO (2026-11-02): kód ve Flexi = číslo zakázky Felucie bez
 * koncovek etap (26-047), stav MÁME, nikdy ho neměnit na HOTOVO (účetní by pak
 * nemohla dopisovat). Párování zpět jde přes kód (stejně jako u faktur).
 * Odběratel (`firma`) = adresář klienta, viz ./adresar.
 */
import { abraGet, abraZapis, type AbraKonfigurace } from './flexi'
import { nazevKlienta, zajistiAdresar, type KlientProAbru } from './adresar'

const TECHNOLOGIE: Record<string, string> = {
  TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  KLIMA: 'Klimatizace',
  REKUPERACE: 'Rekuperace',
  PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika',
}

/** Do Flexi jdou jen čísla zakázek bez koncovky etapy (26-047) */
export const CISLO_ZAKAZKY_ABRA = /^\d{2}-\d{3,}$/

export interface ZakazkaProAbru {
  cislo: string
  technologie: string | null
  klient: KlientProAbru
}

/** Název jako ho píše NANTO ručně: „Příjmení Jméno - Technologie“, u firmy její název (max 255 znaků Flexi) */
export function nazevZakazkyAbra(z: ZakazkaProAbru): string {
  const k = z.klient
  const klient = k.typKlienta === 'FIRMA' ? nazevKlienta(k) : `${k.prijmeni} ${k.jmeno}`.trim()
  const tech = z.technologie ? TECHNOLOGIE[z.technologie] : null
  return (tech ? `${klient} - ${tech}` : klient).slice(0, 255)
}

export function zaznamZakazkyAbra(z: ZakazkaProAbru, extra: { nazev?: string; poznam?: string; firma?: string | null } = {}) {
  return {
    kod: z.cislo,
    nazev: extra.nazev ?? nazevZakazkyAbra(z),
    stavZakazky: 'code:MÁME',
    ...(extra.firma ? { firma: extra.firma } : {}),
    ...(extra.poznam ? { poznam: extra.poznam } : {}),
  }
}

export type VysledekOdeslani = {
  stav: 'EXISTUJE' | 'DOPLNENA_FIRMA' | 'NANECISTO' | 'ZALOZENO'
  abraId: string | null
  /** ID adresáře odběratele (null u dry-run nového záznamu) */
  adresarId: string | null
  adresarZalozen: boolean
  /** Zakázka s tímto kódem už ve Flexi byla (třeba ručně založená účetní) */
  existovala: boolean
}

/**
 * Založí zakázku ve Flexi i s odběratelem. Když kód už existuje: prázdnou
 * firmu doplní, vyplněnou nechá. `dryRun` nic neuloží.
 */
export async function odesliZakazkuDoAbry(
  k: AbraKonfigurace,
  z: ZakazkaProAbru,
  opts: { dryRun?: boolean; nazev?: string; poznam?: string } = {},
): Promise<VysledekOdeslani> {
  if (!CISLO_ZAKAZKY_ABRA.test(z.cislo)) throw new Error(`Číslo zakázky ${z.cislo} není ve tvaru RR-NNN`)
  const [existujici] = await abraGet<{ id: string; firma?: string }>(k, 'zakazka', {
    filtr: `kod = '${z.cislo}'`,
    params: { detail: 'custom:id,kod,firma' },
  })
  if (existujici?.firma) return { stav: 'EXISTUJE', abraId: existujici.id, adresarId: null, adresarZalozen: false, existovala: true }

  const adresar = await zajistiAdresar(k, z.klient, { dryRun: opts.dryRun })
  // U dry-run nového adresáře ID ještě není — zakázka se pak nanečisto validuje bez firmy
  const firma = adresar.abraId

  if (existujici) {
    if (opts.dryRun) return { stav: 'NANECISTO', abraId: existujici.id, adresarId: firma, adresarZalozen: adresar.zalozeno, existovala: true }
    await abraZapis(k, 'zakazka', { id: existujici.id, firma: firma! })
    return { stav: 'DOPLNENA_FIRMA', abraId: existujici.id, adresarId: firma, adresarZalozen: adresar.zalozeno, existovala: true }
  }
  const { id } = await abraZapis(k, 'zakazka', zaznamZakazkyAbra(z, { ...opts, firma }), { dryRun: opts.dryRun })
  return { stav: opts.dryRun ? 'NANECISTO' : 'ZALOZENO', abraId: id, adresarId: firma, adresarZalozen: adresar.zalozeno, existovala: false }
}
