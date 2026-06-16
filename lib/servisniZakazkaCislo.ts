import type { Prisma } from '@prisma/client'

// Další číslo servisní zakázky ve formátu SZ-YY-NNNN (4 číslice, reset po roce).
//
// MUSÍ běžet uvnitř transakce SPOLU s insertem zakázky. Advisory zámek per
// (org, rok) drží pořadí až do commitu, takže dva souběžné requesty nedostanou
// stejné číslo (na rozdíl od COUNT/MAX bez zámku).
//
// Použití:
//   const z = await prisma.$transaction(async (tx) => {
//     const cislo = await nextServisniZakazkaCislo(tx, orgId)
//     return tx.servisniZakazka.create({ data: { orgId, cislo, ... } })
//   })
export async function nextServisniZakazkaCislo(
  tx: Prisma.TransactionClient,
  orgId: string,
): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(2)
  const prefix = `SZ-${yy}-`

  // Serializace souběžného generování per (org, rok). Zámek se uvolní s koncem tx.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`szc:${orgId}:${yy}`}))`

  const last = await tx.servisniZakazka.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
    select: { cislo: true },
  })

  const n = last?.cislo ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(n + 1).padStart(4, '0')}`
}
