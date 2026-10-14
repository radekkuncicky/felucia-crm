import type { OrgPrismaClient } from './orgPrisma'

/**
 * Přiřadí dodavatele produktům (hromadně z katalogu / „zapamatovat" z objednávky).
 * Existující vazbu nechá, nová vznikne bez kódu a ceny. Hlavním se dodavatel stane,
 * když o to volající požádá, nebo když produkt hlavního dodavatele ještě nemá.
 * Produkty a dodavatel se ověřují v rámci org (RLS cizí FK nehlídá).
 */
export async function priraditDodavateleProduktum(
  db: OrgPrismaClient,
  orgId: string,
  productIds: string[],
  dodavatelId: string,
  opts: { hlavni?: boolean } = {},
): Promise<{ pridano: number; hlavnich: number; nenalezeno: number }> {
  const unikatni = Array.from(new Set(productIds))
  const [dodavatel, produkty] = await Promise.all([
    db.dodavatel.findFirst({ where: { id: dodavatelId, orgId }, select: { id: true } }),
    db.product.findMany({
      where: { id: { in: unikatni }, orgId },
      select: { id: true, dodavatele: { select: { dodavatelId: true, hlavni: true } } },
    }),
  ])
  if (!dodavatel) return { pridano: 0, hlavnich: 0, nenalezeno: unikatni.length }

  let pridano = 0
  let hlavnich = 0
  await db.$transaction(async tx => {
    for (const p of produkty) {
      const existuje = p.dodavatele.find(d => d.dodavatelId === dodavatelId)
      const budeHlavni = opts.hlavni === true || !p.dodavatele.some(d => d.hlavni)
      if (budeHlavni && !existuje?.hlavni) {
        await tx.productDodavatel.updateMany({ where: { orgId, productId: p.id }, data: { hlavni: false } })
        hlavnich++
      }
      if (existuje) {
        if (budeHlavni && !existuje.hlavni) {
          await tx.productDodavatel.updateMany({ where: { orgId, productId: p.id, dodavatelId }, data: { hlavni: true } })
        }
        continue
      }
      await tx.productDodavatel.create({ data: { orgId, productId: p.id, dodavatelId, hlavni: budeHlavni } })
      pridano++
    }
  })
  return { pridano, hlavnich, nenalezeno: unikatni.length - produkty.length }
}
