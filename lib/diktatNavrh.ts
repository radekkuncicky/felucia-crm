import type { OrgPrismaClient } from './orgPrisma'
import { najdiVolajiciho, klientNazev, OTEVRENE_STAVY_OP, MIN_CISLIC } from './zapisHovoru'
import { bezDiakritiky } from './hledani'

/**
 * Návrh, kam diktát připojit (inbox „Ke zpracování“) — bez AI, zdarma:
 *  1. telefon v textu → klient s otevřeným OP / otevřený lead (najdiVolajiciho)
 *  2. příjmení klienta otevřeného OP (nebo jméno leadu) v textu — se skloňováním
 *     („Novák“ najde „Nováka“, „Novákovi“), jen slova od 4 písmen
 * Vrací max. 3 návrhy, telefon má přednost. Rozhoduje vždy člověk.
 */

export interface DiktatNavrh {
  druh: 'OP' | 'LEAD'
  id: string
  label: string
  duvod: string
}

const MAX_NAVRHU = 3

/** Telefonní čísla v textu (9+ číslic, s mezerami / předvolbou) */
export function telefonyVTextu(text: string): string[] {
  const kandidati = text.match(/(?:\+?\d[\d\s-]{7,}\d)/g) ?? []
  const vysledek = new Set<string>()
  for (const k of kandidati) {
    const cislice = k.replace(/\D/g, '')
    if (cislice.length >= 9 && cislice.length <= 12) vysledek.add(cislice)
  }
  return Array.from(vysledek).slice(0, 3)
}

/** Kmen jména pro hledání v ohýbaném textu: „Novák“ → „novak“, „Svoboda“ → „svobod“ */
export function kmenJmena(jmeno: string | null | undefined): string | null {
  const s = bezDiakritiky(jmeno).trim()
  if (s.length < 4 || /\s/.test(s)) return null
  return /[aeiouy]$/.test(s) && s.length > 4 ? s.slice(0, -1) : s
}

/** Obsahuje text slovo začínající kmenem? (hranice slova, bez diakritiky) */
export function textZminuje(textBezDiakritiky: string, kmen: string): boolean {
  return new RegExp(`(^|[^a-z0-9])${kmen.replace(/[^a-z0-9]/g, '')}[a-z]{0,4}($|[^a-z0-9])`).test(textBezDiakritiky)
}

export async function navrhniCil(
  db: OrgPrismaClient,
  orgId: string,
  text: string,
  dealScope: Record<string, unknown>,
  maLeady: boolean,
): Promise<DiktatNavrh[]> {
  const navrhy: DiktatNavrh[] = []
  const pridej = (n: DiktatNavrh) => {
    if (navrhy.length < MAX_NAVRHU && !navrhy.some(x => x.druh === n.druh && x.id === n.id)) navrhy.push(n)
  }

  for (const tel of telefonyVTextu(text)) {
    if (tel.length < MIN_CISLIC) continue
    const shody = await najdiVolajiciho(db, orgId, tel, dealScope)
    for (const k of shody.klienti) {
      for (const op of k.otevreneOp) pridej({ druh: 'OP', id: op.id, label: [op.kod, k.nazev, op.predmet].filter(Boolean).join(' · '), duvod: 'telefon' })
    }
    if (maLeady) for (const l of shody.leady) pridej({ druh: 'LEAD', id: l.id, label: [l.jmeno, l.firma].filter(Boolean).join(' · '), duvod: 'telefon' })
  }
  if (navrhy.length >= MAX_NAVRHU) return navrhy

  const t = bezDiakritiky(text)
  const [deals, leady] = await Promise.all([
    db.deal.findMany({
      where: { orgId, ...dealScope, stav: { in: [...OTEVRENE_STAVY_OP] } },
      select: { id: true, kod: true, predmet: true, client: { select: { jmeno: true, prijmeni: true, typKlienta: true } } },
      orderBy: { vytvoreno: 'desc' },
      take: 400,
    }),
    maLeady
      ? db.lead.findMany({
          where: { orgId, status: { notIn: ['PREVEDEN', 'ZRUSEN'] } },
          select: { id: true, jmeno: true, firma: true },
          orderBy: { vytvoreno: 'desc' },
          take: 200,
        })
      : Promise.resolve([]),
  ])

  for (const d of deals) {
    if (!d.client) continue
    const c = d.client
    const kmen = kmenJmena(c.typKlienta === 'FIRMA' ? c.jmeno.split(/\s+/)[0] : c.prijmeni)
    if (kmen && textZminuje(t, kmen)) {
      pridej({ druh: 'OP', id: d.id, label: [d.kod, klientNazev(c), d.predmet].filter(Boolean).join(' · '), duvod: 'jméno' })
    }
  }
  for (const l of leady) {
    const slova = l.jmeno.trim().split(/\s+/)
    const kmen = kmenJmena(slova[slova.length - 1])
    if (kmen && textZminuje(t, kmen)) pridej({ druh: 'LEAD', id: l.id, label: [l.jmeno, l.firma].filter(Boolean).join(' · '), duvod: 'jméno' })
  }
  return navrhy
}
