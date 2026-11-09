/**
 * F2: odběratel zakázky = záznam v adresáři Flexi, založený z klienta Felucie.
 *
 * Bez párování na ručně zadané záznamy (rozhodnutí NANTO 2026-11-08). Záznam
 * nese externí ID `ext:FELUCIA:klient:<clientId>`, další zakázka téhož klienta
 * ho podle něj najde a použije znovu. Existující záznam se nepřepisuje (účetní
 * ho mohla upravit). Kód (zkratku) generuje Flexi sám.
 */
import { abraGetJeden, abraZapis, type AbraKonfigurace } from './flexi'

export interface KlientProAbru {
  id: string
  typKlienta: string
  /** u FIRMA název firmy */
  jmeno: string
  /** u FIRMA kontaktní osoba */
  prijmeni: string
  telefon?: string | null
  email?: string | null
  ulice?: string | null
  mesto?: string | null
  psc?: string | null
  ico?: string | null
  dic?: string | null
}

export const extIdKlienta = (clientId: string) => `ext:FELUCIA:klient:${clientId}`

/** Odběratel nemá údaje, které musí být na daňovém dokladu (Rocketas 2026-11-09) */
export class NeuplnyOdberatel extends Error {
  constructor(public chybi: string[]) {
    super(`U klienta chybí ${chybi.join(', ')} — na faktuře musí být celá adresa${chybi.includes('IČO') ? ' a u firmy IČO' : ''}. Doplňte je v kartě klienta.`)
  }
}

/** Co chybí pro založení odběratele: vždy ulice, město, PSČ; u firmy IČO. DIČ jen pokud ho firma má (neplátci ho nemají). */
export function chybejiciUdajeOdberatele(k: KlientProAbru): string[] {
  const prazdne = (v?: string | null) => !v?.trim()
  const chybi: string[] = []
  if (prazdne(k.ulice)) chybi.push('ulice')
  if (prazdne(k.mesto)) chybi.push('město')
  if (prazdne(k.psc)) chybi.push('PSČ')
  if (k.typKlienta === 'FIRMA' && prazdne(k.ico)) chybi.push('IČO')
  return chybi
}

export function nazevKlienta(k: Pick<KlientProAbru, 'typKlienta' | 'jmeno' | 'prijmeni'>): string {
  return (k.typKlienta === 'FIRMA' ? k.jmeno : `${k.jmeno} ${k.prijmeni}`).trim()
}

/** Záznam adresáře — fyzická osoba jméno + kontakty, firma navíc IČO a DIČ; prázdná pole se neposílají */
export function zaznamAdresare(k: KlientProAbru): Record<string, string> {
  const pole: Record<string, string | null | undefined> = {
    id: extIdKlienta(k.id),
    nazev: nazevKlienta(k).slice(0, 255),
    ulice: k.ulice,
    mesto: k.mesto,
    psc: k.psc,
    tel: k.telefon,
    email: k.email,
    ...(k.typKlienta === 'FIRMA' ? { ic: k.ico, dic: k.dic } : {}),
    stat: 'code:CZ',
    typVztahuK: 'typVztahu.odberDodav',
  }
  return Object.fromEntries(
    Object.entries(pole).map(([kl, v]) => [kl, v?.trim()]).filter((e): e is [string, string] => !!e[1]),
  )
}

/** ID adresáře klienta ve Flexi — najde podle ext ID, jinak založí. U dry-run nic neuloží (id null). */
export async function zajistiAdresar(
  k: AbraKonfigurace,
  klient: KlientProAbru,
  opts: { dryRun?: boolean } = {},
): Promise<{ abraId: string | null; zalozeno: boolean }> {
  const existujici = await abraGetJeden<{ id: string }>(k, 'adresar', extIdKlienta(klient.id), { detail: 'custom:id' })
  if (existujici) return { abraId: existujici.id, zalozeno: false }
  // Existující záznam nepřepisujeme, takže neúplný by na fakturách zůstal neúplný → nezakládat
  const chybi = chybejiciUdajeOdberatele(klient)
  if (chybi.length) throw new NeuplnyOdberatel(chybi)
  const { id } = await abraZapis(k, 'adresar', zaznamAdresare(klient), opts)
  return { abraId: opts.dryRun ? null : id, zalozeno: true }
}
