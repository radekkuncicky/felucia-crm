import { Prisma } from '@prisma/client'
import type { OrgPrismaClient } from '@/lib/orgPrisma'
import { hledanaSlova } from '@/lib/hledani'

/**
 * ID klientů org, kteří odpovídají dotazu bez ohledu na diakritiku
 * („kuncicky“ → „Kunčický“) a pořadí slov („jan novak“ → „Novák Jan“).
 * Každé slovo musí být ve jménu, příjmení, e-mailu nebo telefonu.
 * Raw SQL (f_unaccent z migrace unaccent_hledani) → uvnitř $transaction kvůli RLS.
 * Prázdný dotaz → null (= nefiltrovat).
 */
export async function najdiKlientIds(db: OrgPrismaClient, orgId: string, q: string | null | undefined, limit = 200): Promise<string[] | null> {
  const slova = hledanaSlova(q)
  if (slova.length === 0) return null

  const text = Prisma.sql`f_unaccent(lower(
    coalesce(jmeno, '') || ' ' || coalesce(prijmeni, '') || ' ' || coalesce(email, '') || ' ' ||
    coalesce(telefon, '') || ' ' || replace(coalesce(telefon, ''), ' ', '')
  ))`
  const podminky = slova.map((s) => Prisma.sql`${text} LIKE ${'%' + s.replace(/[\\%_]/g, (c) => '\\' + c) + '%'}`)

  const rows = await db.$transaction(async (tx) =>
    tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM clients
      WHERE "orgId" = ${orgId} AND ${Prisma.join(podminky, ' AND ')}
      ORDER BY vytvoreno DESC
      LIMIT ${limit}`,
  )
  return rows.map((r) => r.id)
}

/**
 * Prohledávatelné tabulky pro najdiIdsBezDiakritiky. Identifikátory jsou konstanty
 * (jdou do SQL přes Prisma.raw) — nikdy sem nedávat vstup od uživatele.
 * klientFk: připojí jméno/příjmení klienta, takže „novak klima“ najde zakázku
 * „Klimatizace“ klienta Nováka.
 */
const HLEDATELNE = {
  zakazka: { tabulka: 'zakazky', sloupce: ['cislo', 'nazev', 'mistoStavby'], klientFk: 'klientId' },
  deal: { tabulka: 'deals', sloupce: ['kod', 'predmet', 'adresaDila'], klientFk: 'clientId' },
  lead: { tabulka: 'leady', sloupce: ['jmeno', 'firma', 'email', 'telefon'] },
  product: { tabulka: 'products', sloupce: ['nazev', 'kod', 'produktovaRada'] },
  servis: { tabulka: 'servisni_zakazky', sloupce: ['cislo', 'popis'], klientFk: 'klientId' },
  skladPohyb: { tabulka: 'sklad_pohyby', sloupce: ['nazev'] },
} as const satisfies Record<string, { tabulka: string; sloupce: readonly string[]; klientFk?: string }>

export type Hledatelne = keyof typeof HLEDATELNE

/**
 * ID záznamů org, kde každé slovo dotazu je v některém sloupci (bez diakritiky,
 * bez ohledu na velikost písmen a pořadí slov). Prázdný dotaz → null (= nefiltrovat).
 */
export async function najdiIdsBezDiakritiky(
  db: OrgPrismaClient, orgId: string, co: Hledatelne, q: string | null | undefined, limit = 500,
): Promise<string[] | null> {
  const slova = hledanaSlova(q)
  if (slova.length === 0) return null
  const def: { tabulka: string; sloupce: readonly string[]; klientFk?: string } = HLEDATELNE[co]

  const casti = def.sloupce.flatMap((s) => {
    const c = `coalesce(t."${s}", '')`
    return s === 'telefon' ? [c, `replace(${c}, ' ', '')`] : [c]
  })
  if (def.klientFk) casti.push(`coalesce(k.jmeno, '')`, `coalesce(k.prijmeni, '')`)
  const text = Prisma.raw(`f_unaccent(lower(${casti.join(` || ' ' || `)}))`)
  const join = def.klientFk ? Prisma.raw(`LEFT JOIN clients k ON k.id = t."${def.klientFk}"`) : Prisma.empty
  const podminky = slova.map((s) => Prisma.sql`${text} LIKE ${'%' + s.replace(/[\\%_]/g, (c) => '\\' + c) + '%'}`)

  const rows = await db.$transaction(async (tx) =>
    tx.$queryRaw<{ id: string }[]>`
      SELECT t.id FROM ${Prisma.raw(`"${def.tabulka}"`)} t ${join}
      WHERE t."orgId" = ${orgId} AND ${Prisma.join(podminky, ' AND ')}
      LIMIT ${limit}`,
  )
  return rows.map((r) => r.id)
}
