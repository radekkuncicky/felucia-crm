import type { Technologie, ZamereniFotoTag } from '@prisma/client'
import type { OrgPrismaClient } from '@/lib/orgPrisma'

/**
 * Config-driven formuláře zaměření (Felucia Sales). Výchozí definice žijí
 * tady v kódu jako fallback — org bez vlastního záznamu v zamereni_definice
 * dostane default (id: null, verze: 0). Úprava otázek bez release aplikace:
 * vložit/aktualizovat řádek v DB, appka si při dalším zaměření stáhne novou
 * verzi. Uzavřená zaměření drží definiceId+definiceVerze, se kterými vznikla.
 */

export type ZamereniOtazka = {
  klic: string
  popisek: string
  typ: 'TEXT' | 'CISLO' | 'BOOLEAN' | 'VYBER' | 'VICE_VYBER'
  moznosti?: string[]
  jednotka?: string
  povinne?: boolean
  napoveda?: string
  /** Otázka se zobrazí (a případná povinnost platí) jen když jiná odpověď má danou hodnotu */
  zobrazitKdyz?: { klic: string; rovnaSe: string | boolean }
}

export type ZamereniSekce = { nazev: string; otazky: ZamereniOtazka[] }
export type ZamereniSchema = { sekce: ZamereniSekce[] }

export type ZamereniDefiniceData = {
  /** null = výchozí definice z kódu (org nemá vlastní v DB) */
  id: string | null
  verze: number
  nazev: string
  typ: Technologie
  schemaJson: ZamereniSchema
  povinneTagy: ZamereniFotoTag[]
}

// Společné sekce pro všechny typy zakázek
const SPOLECNE_SEKCE: ZamereniSekce[] = [
  {
    nazev: 'Objekt',
    otazky: [
      { klic: 'adresa', popisek: 'Adresa místa instalace', typ: 'TEXT', povinne: true },
      { klic: 'patrovost', popisek: 'Počet podlaží', typ: 'CISLO' },
      { klic: 'rok_stavby', popisek: 'Rok stavby / rekonstrukce', typ: 'CISLO' },
      {
        klic: 'stavajici_zdroj', popisek: 'Stávající zdroj tepla', typ: 'VYBER', povinne: true,
        moznosti: ['Plynový kotel', 'Elektrokotel', 'Kotel na tuhá paliva', 'Tepelné čerpadlo', 'Přímotopy', 'Jiné', 'Žádný'],
      },
    ],
  },
  {
    nazev: 'Elektro',
    otazky: [
      { klic: 'jistic', popisek: 'Hlavní jistič', typ: 'VYBER', moznosti: ['16 A', '20 A', '25 A', '32 A', '40 A', 'Jiný'], povinne: true },
      { klic: 'pocet_fazi', popisek: 'Počet fází', typ: 'VYBER', moznosti: ['1', '3'], povinne: true },
      { klic: 'stav_rozvadece', popisek: 'Stav rozvaděče', typ: 'VYBER', moznosti: ['Vyhovující', 'Nutná úprava', 'Nutná výměna'], povinne: true },
    ],
  },
  {
    nazev: 'Přístup a manipulace',
    otazky: [
      { klic: 'pristup', popisek: 'Přístup k místu instalace (parkování, výtah, schody)', typ: 'TEXT' },
      { klic: 'poznamka', popisek: 'Poznámka k zaměření', typ: 'TEXT' },
    ],
  },
]

const TC_SEKCE: ZamereniSekce[] = [
  {
    nazev: 'Tepelné čerpadlo',
    otazky: [
      { klic: 'tepelna_ztrata', popisek: 'Tepelná ztráta', typ: 'CISLO', jednotka: 'kW', napoveda: 'Pokud není známa, vyplňte vytápěnou plochu' },
      { klic: 'vytapena_plocha', popisek: 'Vytápěná plocha', typ: 'CISLO', jednotka: 'm²', povinne: true },
      { klic: 'otopna_soustava', popisek: 'Otopná soustava', typ: 'VYBER', moznosti: ['Radiátory', 'Podlahové topení', 'Kombinace'], povinne: true },
      { klic: 'teplotni_spad', popisek: 'Teplotní spád', typ: 'VYBER', moznosti: ['35/30', '45/40', '55/45', '70/55', 'Nezjištěno'] },
      { klic: 'ohrev_tuv', popisek: 'Ohřev teplé vody (TUV)', typ: 'BOOLEAN', povinne: true },
      { klic: 'objem_zasobniku', popisek: 'Požadovaný objem zásobníku', typ: 'CISLO', jednotka: 'l', zobrazitKdyz: { klic: 'ohrev_tuv', rovnaSe: true } },
      { klic: 'umisteni_vj', popisek: 'Umístění venkovní jednotky', typ: 'TEXT', povinne: true },
      { klic: 'delka_trasy', popisek: 'Délka trasy (venkovní–vnitřní jednotka)', typ: 'CISLO', jednotka: 'm', povinne: true },
      { klic: 'odvod_kondenzatu', popisek: 'Odvod kondenzátu', typ: 'VYBER', moznosti: ['Vsak', 'Kanalizace', 'Nutno řešit'] },
      { klic: 'akumulace', popisek: 'Akumulační nádrž', typ: 'BOOLEAN' },
    ],
  },
]

const KLIMA_SEKCE: ZamereniSekce[] = [
  {
    nazev: 'Klimatizace',
    otazky: [
      { klic: 'pocet_jednotek', popisek: 'Počet vnitřních jednotek', typ: 'CISLO', povinne: true },
      { klic: 'typ_jednotek', popisek: 'Typ vnitřních jednotek', typ: 'VICE_VYBER', moznosti: ['Nástěnná', 'Kazetová', 'Parapetní', 'Kanálová'], povinne: true },
      { klic: 'mistnosti', popisek: 'Místnosti (název + plocha)', typ: 'TEXT', povinne: true },
      { klic: 'delky_tras', popisek: 'Délky tras chladiva', typ: 'TEXT', napoveda: 'Po jednotkách, v metrech' },
      { klic: 'prostupy', popisek: 'Prostupy (materiál stěn, počet)', typ: 'TEXT' },
      { klic: 'vyska_montaze', popisek: 'Výška montáže venkovní jednotky', typ: 'CISLO', jednotka: 'm' },
      { klic: 'plosina', popisek: 'Potřeba plošiny', typ: 'BOOLEAN', povinne: true },
    ],
  },
]

const REKUPERACE_SEKCE: ZamereniSekce[] = [
  {
    nazev: 'Rekuperace',
    otazky: [
      { klic: 'podlahova_plocha', popisek: 'Podlahová plocha', typ: 'CISLO', jednotka: 'm²', povinne: true },
      { klic: 'pocet_mistnosti', popisek: 'Počet místností', typ: 'CISLO', povinne: true },
      { klic: 'vedeni_potrubi', popisek: 'Vedení potrubí', typ: 'VYBER', moznosti: ['Podhled', 'Podlaha', 'Kombinace'], povinne: true },
      { klic: 'umisteni_jednotky', popisek: 'Umístění rekuperační jednotky', typ: 'TEXT', povinne: true },
      { klic: 'distribucni_elementy', popisek: 'Typ distribučních elementů', typ: 'VYBER', moznosti: ['Talířové ventily', 'Designové mřížky', 'Štěrbinové vyústky'] },
    ],
  },
]

const PODLAHOVKA_SEKCE: ZamereniSekce[] = [
  {
    nazev: 'Podlahové topení',
    otazky: [
      { klic: 'plochy_mistnosti', popisek: 'Plochy místností (název + m²)', typ: 'TEXT', povinne: true },
      { klic: 'skladba_podlahy', popisek: 'Skladba podlahy', typ: 'TEXT', povinne: true },
      { klic: 'pocet_rozdelovacu', popisek: 'Počet rozdělovačů', typ: 'CISLO', povinne: true },
      { klic: 'umisteni_rozdelovacu', popisek: 'Umístění rozdělovačů', typ: 'TEXT' },
    ],
  },
]

const DEFAULTS: Record<Technologie, { nazev: string; sekce: ZamereniSekce[]; povinneTagy: ZamereniFotoTag[] }> = {
  TEPELNE_CERPADLO: {
    nazev: 'Zaměření — tepelné čerpadlo',
    sekce: [...SPOLECNE_SEKCE.slice(0, 2), ...TC_SEKCE, SPOLECNE_SEKCE[2]],
    povinneTagy: ['ROZVADEC', 'STAVAJICI_ZDROJ', 'VENKOVNI_JEDNOTKA', 'CELKOVY_POHLED'],
  },
  KLIMA: {
    nazev: 'Zaměření — klimatizace',
    sekce: [...SPOLECNE_SEKCE.slice(0, 2), ...KLIMA_SEKCE, SPOLECNE_SEKCE[2]],
    povinneTagy: ['ROZVADEC', 'VNITRNI_JEDNOTKA', 'VENKOVNI_JEDNOTKA'],
  },
  REKUPERACE: {
    nazev: 'Zaměření — rekuperace',
    sekce: [...SPOLECNE_SEKCE.slice(0, 2), ...REKUPERACE_SEKCE, SPOLECNE_SEKCE[2]],
    povinneTagy: ['ROZVADEC', 'CELKOVY_POHLED'],
  },
  PODLAHOVE_TOPENI: {
    nazev: 'Zaměření — podlahové topení',
    sekce: [...SPOLECNE_SEKCE.slice(0, 2), ...PODLAHOVKA_SEKCE, SPOLECNE_SEKCE[2]],
    povinneTagy: ['ROZVADEC', 'CELKOVY_POHLED'],
  },
  VZDUCHOTECHNIKA: {
    nazev: 'Zaměření — vzduchotechnika',
    sekce: SPOLECNE_SEKCE,
    povinneTagy: ['CELKOVY_POHLED'],
  },
  JINE: {
    nazev: 'Zaměření',
    sekce: SPOLECNE_SEKCE,
    povinneTagy: ['CELKOVY_POHLED'],
  },
}

/** Aktivní definice pro org a typ: nejnovější verze z DB, jinak default z kódu. */
export async function getAktivniDefinice(
  db: OrgPrismaClient,
  typ: Technologie,
): Promise<ZamereniDefiniceData> {
  const vlastni = await db.zamereniDefinice.findFirst({
    where: { typ, aktivni: true },
    orderBy: { verze: 'desc' },
  })
  if (vlastni) {
    return {
      id: vlastni.id,
      verze: vlastni.verze,
      nazev: vlastni.nazev,
      typ,
      schemaJson: vlastni.schemaJson as unknown as ZamereniSchema,
      povinneTagy: vlastni.povinneTagy,
    }
  }
  const def = DEFAULTS[typ]
  return { id: null, verze: 0, nazev: def.nazev, typ, schemaJson: { sekce: def.sekce }, povinneTagy: def.povinneTagy }
}

/** Definice, se kterou zaměření vzniklo (fixovaná verze); fallback na aktivní/default. */
export async function getDefiniceProZamereni(
  db: OrgPrismaClient,
  zamereni: { typ: Technologie; definiceId: string | null; definiceVerze: number | null },
): Promise<ZamereniDefiniceData> {
  if (zamereni.definiceId) {
    const d = await db.zamereniDefinice.findUnique({ where: { id: zamereni.definiceId } })
    if (d) {
      return {
        id: d.id,
        verze: d.verze,
        nazev: d.nazev,
        typ: zamereni.typ,
        schemaJson: d.schemaJson as unknown as ZamereniSchema,
        povinneTagy: d.povinneTagy,
      }
    }
  }
  return getAktivniDefinice(db, zamereni.typ)
}

function jeVyplnena(hodnota: unknown): boolean {
  if (hodnota === null || hodnota === undefined) return false
  if (typeof hodnota === 'string') return hodnota.trim() !== ''
  if (Array.isArray(hodnota)) return hodnota.length > 0
  if (typeof hodnota === 'boolean') return true
  if (typeof hodnota === 'number') return !Number.isNaN(hodnota)
  return true
}

function jeZobrazena(otazka: ZamereniOtazka, odpovedi: Record<string, unknown>): boolean {
  if (!otazka.zobrazitKdyz) return true
  return odpovedi[otazka.zobrazitKdyz.klic] === otazka.zobrazitKdyz.rovnaSe
}

/** Nevyplněné povinné otázky (skryté podmíněné otázky se nepočítají). */
export function chybejiciOtazky(
  schema: ZamereniSchema,
  odpovedi: Record<string, unknown>,
): ZamereniOtazka[] {
  const chybi: ZamereniOtazka[] = []
  for (const sekce of schema.sekce ?? []) {
    for (const otazka of sekce.otazky ?? []) {
      if (!otazka.povinne) continue
      if (!jeZobrazena(otazka, odpovedi)) continue
      if (!jeVyplnena(odpovedi[otazka.klic])) chybi.push(otazka)
    }
  }
  return chybi
}

/** Povinné foto tagy, ke kterým zatím není žádná fotka. */
export function chybejiciTagy(
  povinneTagy: ZamereniFotoTag[],
  fotky: { tag: ZamereniFotoTag }[],
): ZamereniFotoTag[] {
  const mam = new Set(fotky.map(f => f.tag))
  return povinneTagy.filter(t => !mam.has(t))
}
