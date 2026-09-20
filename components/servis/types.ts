// Sdílené typy servisního portfolia (klient → zařízení → kontrakt → zakázky).
// Serializované z page.tsx (Date → ISO string, Decimal → number/string).

import type { ServisniZakazkaStav } from '@/lib/servisStav'

export type ServisTyp = 'ROCNI' | 'POLOLETNI' | 'DVOULETNI' | 'JEDNOURAZOVY'

export const SERVIS_TYP_LABELS: Record<ServisTyp, string> = {
  ROCNI: 'Roční',
  POLOLETNI: 'Pololetní',
  DVOULETNI: 'Dvouletý',
  JEDNOURAZOVY: 'Jednorázový',
}

export interface KlientRef {
  id: string
  jmeno: string
  prijmeni: string
}

export interface ZarizeniRef {
  id: string
  nazev: string
  typ: string
  vyrobniCislo: string | null
}

/** Zakázka v timeline kontraktu / karty zařízení (bez protokolu — ten je v detailu zakázky). */
export interface NavstevaRef {
  id: string
  cislo: string | null
  typ: string
  stav: ServisniZakazkaStav | string
  popis: string | null
  priorita: string
  planovanyTermin: string | null
  skutecnyTermin: string | null
  technik: { id: string; jmeno: string } | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  trvaniMinut: number | null
  nakladyCas: number | null
  nakladyMaterial: number | null
  podpisKlienta: string | null
}

export interface Kontrakt {
  id: string
  cisloKontraktu: string | null
  nazev: string
  typ: ServisTyp
  intervalMesicu: number
  cena: string | null
  zacatek: string
  konec: string | null
  aktivni: boolean
  autoRenewal: boolean
  klient: KlientRef
  zarizeni: ZarizeniRef | null
  deal: { id: string; kod: string | null; predmet: string | null } | null
  servisniZakazky: NavstevaRef[]
}

export interface Zarizeni extends ZarizeniRef {
  datumInstalace: string | null
  zarukaDo: string | null
  aktivni: boolean
  qrToken: string | null
  klientId: string
  deal: { id: string; kod: string | null; predmet: string | null } | null
  kontrakty: Kontrakt[]
  zakazky: NavstevaRef[]
}

export interface OrgUser {
  id: string
  jmeno: string
}

/** Následující naplánovaná návštěva (nejbližší v budoucnu, nebo prošlá). */
export function pristiNavsteva(zakazky: NavstevaRef[]): NavstevaRef | null {
  return zakazky
    .filter(n => n.stav === 'NAPLANOVANA' && n.planovanyTermin)
    .sort((a, b) => a.planovanyTermin!.localeCompare(b.planovanyTermin!))[0] ?? null
}

/** Poslední dokončená návštěva (DOKONCENA/VYUCTOVANA/UZAVRENA). */
export function posledniDokoncena(zakazky: NavstevaRef[]): NavstevaRef | null {
  return zakazky
    .filter(n => ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(n.stav))
    .sort((a, b) => (b.skutecnyTermin ?? b.planovanyTermin ?? '').localeCompare(a.skutecnyTermin ?? a.planovanyTermin ?? ''))[0] ?? null
}

export function zarukaStav(zarukaDo: string | null): 'ok' | 'konci' | 'vyprsela' | null {
  if (!zarukaDo) return null
  const dni = (new Date(zarukaDo).getTime() - Date.now()) / 86_400_000
  if (dni < 0) return 'vyprsela'
  if (dni < 90) return 'konci'
  return 'ok'
}
