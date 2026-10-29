import type { OrgPrismaClient } from './orgPrisma'

/**
 * Nastaví nabídku jako aktivní v jejím OP a ostatní nabídky OP přepne na
 * neaktivní — v jedné transakci, aby OP nikdy neměl dvě aktivní ani žádnou.
 * Hodnota OP se neukládá: počítá se vždy z aktivní nabídky (quoteCelkemBezDph).
 * Přístup k nabídce ověřuje volající.
 */
export async function nastavAktivniNabidku(db: OrgPrismaClient, p: { orgId: string; dealId: string; quoteId: string }) {
  await db.$transaction(async tx => {
    await tx.quote.updateMany({ where: { orgId: p.orgId, dealId: p.dealId, id: { not: p.quoteId } }, data: { aktivni: false } })
    await tx.quote.updateMany({ where: { orgId: p.orgId, dealId: p.dealId, id: p.quoteId }, data: { aktivni: true } })
  })
}
