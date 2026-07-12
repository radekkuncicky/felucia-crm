import type { Prisma } from '@prisma/client'

// Další číslo servisního kontraktu ve formátu SK-YY-NNN (3 číslice, reset po
// roce). Stejný vzor jako nextServisniZakazkaCislo: MUSÍ běžet uvnitř transakce
// spolu s insertem kontraktu — advisory zámek per (org, rok) drží pořadí do
// commitu, souběžné requesty nedostanou stejné číslo (na rozdíl od COUNT+1).
//
// Historická čísla mimo formát (SK-0001 z dřívějšího handoffu) se ignorují —
// prefix filtr je nezachytí, číslování jede dál od nejvyššího SK-YY-NNN.
export async function nextServisniKontraktCislo(
  tx: Prisma.TransactionClient,
  orgId: string,
): Promise<string> {
  const yy = new Date().getFullYear().toString().slice(2)
  const prefix = `SK-${yy}-`

  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`skc:${orgId}:${yy}`}))`

  const last = await tx.servisniKontrakt.findFirst({
    where: { orgId, cisloKontraktu: { startsWith: prefix } },
    orderBy: { cisloKontraktu: 'desc' },
    select: { cisloKontraktu: true },
  })

  const n = last?.cisloKontraktu ? parseInt(last.cisloKontraktu.slice(prefix.length), 10) : 0
  return `${prefix}${String(n + 1).padStart(3, '0')}`
}
