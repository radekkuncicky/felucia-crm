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
