// Ukázková data veřejného webu - JEDEN zdroj pro všechny ukázky (mocky, hero, telefon).
// Vše je smyšlené. Formáty čísel, názvy stavů, polí a rolí odpovídají aplikaci
// (docs/homepage-facts.md); celý příběh jede v řadě 101.

export const DEMO_KLIENT = {
  jmeno: 'Jana Nováková',
  objekt: 'Rodinný dům',
  mesto: 'Ostrava-Poruba',
  telefon: '+420 123 456 101',
  email: 'jana.novakova@example.cz',
} as const

export const DEMO_TECHNOLOGIE = 'Tepelné čerpadlo'
export const DEMO_ZARIZENI = 'Tepelné čerpadlo vzduch-voda 9 kW'

/** Lidé ve firmě a jejich role (role = skutečné role aplikace, vedoucí = pole na zakázce). */
export const DEMO_LIDE = {
  obchodnik: { jmeno: 'Karel Beneš', role: 'Obchodník' },
  vedouci: { jmeno: 'Lucie Malá', role: 'Manažer zakázek' },
  technik: { jmeno: 'Petr Svoboda', role: 'Technik' },
} as const

export const DEMO_DOKLADY = {
  poptavka: 'Poptávka z webu',
  op: 'OP-26-101',
  nabidka: 'NAB-26-0101',
  sod: 'SOD-26-101',
  zakazka: '26-101',
  protokol: 'PP-26-101',
  vyuctovani: 'VYU-26-101',
  servis: 'SZ-26-0101',
  kontrakt: 'SK-26-101',
} as const

export const DEMO_TERMIN = {
  montazKratce: 'čt 15. 10.',
  montaz: 'čt 15. 10. 2026',
  cas: '7:30',
  den: 'Čtvrtek 15. října',
  sodZhotovitel: '6. 10. 2026 14:12',
  sodKlient: '7. 10. 2026 19:48',
  dalsiProhlidka: 'říjen 2027',
  zarukaDo: '15. 10. 2029',
} as const

export type TypPolozky = 'MATERIAL' | 'PRACE'

export interface DemoPolozka {
  id: string
  nazev: string
  /** krátký název pro mobil a telefon */
  kratce: string
  typ: TypPolozky
  jednotka: string
  /** množství v nabídce = Plánováno v protokolu */
  mnozstvi: number
  /** skutečně použito (předávací protokol) */
  pouzito: number
  /** cena za jednotku bez DPH, Kč */
  cena: number
  /** stav materiálu u zakázky (UI názvy: Čeká, Objednáno, Rezervováno, Vydáno) */
  stav?: MaterialStav
}

export type MaterialStav = 'Čeká' | 'Objednáno' | 'Rezervováno' | 'Vydáno'
export const MATERIAL_STAVY: MaterialStav[] = ['Čeká', 'Objednáno', 'Rezervováno', 'Vydáno']

/** Nabídka NAB-26-0101: součet 248 600 Kč bez DPH. Na stavbě padlo 12 m potrubí místo 10 m. */
export const DEMO_POLOZKY: DemoPolozka[] = [
  { id: 'tc', nazev: 'Tepelné čerpadlo vzduch-voda 9 kW', kratce: 'TČ vzduch-voda 9 kW', typ: 'MATERIAL', jednotka: 'ks', mnozstvi: 1, pouzito: 1, cena: 168_900, stav: 'Vydáno' },
  { id: 'zas', nazev: 'Zásobník teplé vody 200 l', kratce: 'Zásobník TV 200 l', typ: 'MATERIAL', jednotka: 'ks', mnozstvi: 1, pouzito: 1, cena: 28_400, stav: 'Vydáno' },
  { id: 'pot', nazev: 'Izolované propojovací potrubí', kratce: 'Izolované potrubí', typ: 'MATERIAL', jednotka: 'm', mnozstvi: 10, pouzito: 12, cena: 650, stav: 'Rezervováno' },
  { id: 'kon', nazev: 'Konzole a antivibrační podložky', kratce: 'Konzole a podložky', typ: 'MATERIAL', jednotka: 'ks', mnozstvi: 1, pouzito: 1, cena: 4_200, stav: 'Objednáno' },
  { id: 'ele', nazev: 'Elektroinstalace a jištění', kratce: 'Elektroinstalace', typ: 'PRACE', jednotka: 'kpl', mnozstvi: 1, pouzito: 1, cena: 9_800 },
  { id: 'mon', nazev: 'Montáž a uvedení do provozu', kratce: 'Montáž a uvedení', typ: 'PRACE', jednotka: 'kpl', mnozstvi: 1, pouzito: 1, cena: 28_000 },
  { id: 'dop', nazev: 'Doprava', kratce: 'Doprava', typ: 'PRACE', jednotka: 'kpl', mnozstvi: 1, pouzito: 1, cena: 2_800 },
]

export const DEMO_MATERIAL = DEMO_POLOZKY.filter(p => p.typ === 'MATERIAL')

export function soucetNabidky(polozky: DemoPolozka[] = DEMO_POLOZKY): number {
  return polozky.reduce((s, p) => s + p.mnozstvi * p.cena, 0)
}
export function soucetVyuctovani(polozky: DemoPolozka[] = DEMO_POLOZKY): number {
  return polozky.reduce((s, p) => s + p.pouzito * p.cena, 0)
}

/** "248 600 Kč" - nezlomitelné mezery jako v aplikaci (cs-CZ). */
export function kc(n: number): string {
  return `${new Intl.NumberFormat('cs-CZ').format(n)} Kč`
}
export function mnozstvi(n: number, jednotka: string): string {
  return `${new Intl.NumberFormat('cs-CZ').format(n)} ${jednotka}`
}

// ─── Stavy z aplikace (docs/homepage-facts.md) ───────────────────────────────

export const OP_STAVY = ['Nový', 'Jednání', 'Nabídka', 'Před uzavřením', 'Úspěch'] as const
export const ZAKAZKA_STAVY = ['Nová', 'Přiřazena', 'V realizaci', 'Předána', 'Vyúčtována', 'Hotovo'] as const
export const PROTOKOL_STAVY = ['Rozpracován', 'Podepsán', 'Schválen'] as const
export const VYUCTOVANI_STAVY = ['Návrh', 'Ke schválení', 'Schváleno'] as const
/** Hlavní cesta servisní zakázky (lib/servisStav.ts) */
export const SERVIS_STAVY = ['Nová', 'Naplánovaná', 'Probíhá', 'Dokončená', 'Vyúčtovaná', 'Uzavřená'] as const

// ─── Servis ──────────────────────────────────────────────────────────────────

export const DEMO_SERVIS = {
  typ: 'Tepelné čerpadlo',
  vyrobniCislo: 'VC-2026-00101',
  datumInstalace: '15. 10. 2026',
  zarukaDo: DEMO_TERMIN.zarukaDo,
  kontrakt: { cislo: DEMO_DOKLADY.kontrakt, typ: 'Roční', interval: 'každých 12 měsíců' },
  posledni: { datum: '15. 10. 2026', typ: 'Uvedení do provozu' },
  dalsi: { termin: DEMO_TERMIN.dalsiProhlidka, typ: 'Plánovaný servis', cislo: DEMO_DOKLADY.servis, stav: 'Naplánovaná' as const },
}

// ─── Felucia Tech ────────────────────────────────────────────────────────────

export const DEMO_TECH = {
  pokyny: 'Venkovní jednotku na konzoli u severní stěny, odvod kondenzátu do štěrku.',
  podklady: ['Výkres umístění.pdf', 'Schéma zapojení.pdf'],
  fotky: ['Venkovní jednotka', 'Konzole', 'Prostup', 'Vnitřní jednotka', 'Rozvaděč', 'Celkový pohled'],
  dalsiZastavka: { cislo: 'SZ-26-0098', typ: 'Plánovaný servis', misto: 'Ostrava-Zábřeh', cas: '13:00' },
} as const

// ─── Dáša (jen akce, které dnes umí: OP, klienti, nabídky, aktivity, stav OP) ──

export const DEMO_DASA: { kdo: 'uzivatel' | 'dasa'; text: string }[] = [
  { kdo: 'uzivatel', text: 'Založ Janě Novákové z Poruby obchodní případ na tepelné čerpadlo.' },
  { kdo: 'dasa', text: 'Klientku Jana Nováková, Ostrava-Poruba, jsem našla. Mám založit obchodní případ?' },
  { kdo: 'uzivatel', text: 'Ano. A zapiš, že jí zítra volám.' },
  { kdo: 'dasa', text: `Hotovo. Založila jsem ${DEMO_DOKLADY.op} a přidala aktivitu Hovor na zítřek.` },
  { kdo: 'uzivatel', text: 'Připrav nabídku podle vzoru TČ 9 kW.' },
  { kdo: 'dasa', text: `Hotovo. Nabídku ${DEMO_DOKLADY.nabidka} jsem vytvořila podle vzoru: ${DEMO_POLOZKY.length} položek, celkem ${kc(soucetNabidky())} bez DPH.` },
]
