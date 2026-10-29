import type { Prisma } from '@prisma/client'
import type { OrgPrismaClient } from './orgPrisma'
import { generateQuoteKod } from './quoteKod'
import { createWithUniqueKod } from './uniqueKod'

type ZdrojovaNabidka = Prisma.QuoteGetPayload<{ include: { items: true } }>

/**
 * Plná kopie nabídky (položky, slevy, DPH, pořadí, popis) do OP `targetDealId` —
 * tlačítka „Kopie“ / „Kopírovat do OP“ i AI nástroj copy_quote. Kopie je
 * neaktivní a dostane nové číslo. Přístup k oběma OP ověřuje volající.
 */
export async function zkopirujNabidku(
  db: OrgPrismaClient,
  p: { orgId: string; quote: ZdrojovaNabidka; targetDealId: string; nazev: string },
) {
  const items = [...p.quote.items].sort((a, b) => a.poradi - b.poradi)
  return createWithUniqueKod(() => generateQuoteKod(p.orgId), kod => db.quote.create({
    data: {
      orgId: p.orgId,
      dealId: p.targetDealId,
      kod,
      nazev: p.nazev,
      popis: p.quote.popis,
      dphSazba: p.quote.dphSazba,
      aktivni: false,
      items: {
        create: items.map(item => ({
          dealId: p.targetDealId,
          productId: item.productId,
          nazev: item.nazev,
          mnozstvi: item.mnozstvi,
          cenaZaKus: item.cenaZaKus,
          nakupniCena: item.nakupniCena,
          sleva: item.sleva,
          dphSazba: item.dphSazba,
          jednotka: item.jednotka,
          kod: item.kod,
          poznamky: item.poznamky,
          poradi: item.poradi,
        })),
      },
    },
    include: { items: { include: { product: true }, orderBy: { poradi: 'asc' } } },
  }))
}
