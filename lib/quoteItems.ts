import type { OrgPrismaClient } from '@/lib/orgPrisma'
import type { Permissions } from '@/lib/permissions'

/**
 * Snapshot údajů z knihovny produktů pro položku nabídky.
 * Nákupní cena se při vzniku položky zafixuje (stejně jako prodejní) — pozdější
 * změna ceny v knihovně už existující nabídku neovlivní. Mobilní API to dělá
 * stejně (app/api/mobile/obchod/**).
 */
export interface ProductSnapshot {
  id: string
  kod: string | null
  jednotka: string
  nakladovaCena: number | null
}

export async function loadProductSnapshots(
  db: OrgPrismaClient,
  productIds: (string | null | undefined)[],
): Promise<Map<string, ProductSnapshot>> {
  const ids = Array.from(new Set(productIds.filter((x): x is string => !!x)))
  if (ids.length === 0) return new Map()
  const prods = await db.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, kod: true, jednotka: true, nakladovaCena: true },
  })
  return new Map(
    prods.map(p => [
      p.id,
      { id: p.id, kod: p.kod, jednotka: p.jednotka, nakladovaCena: p.nakladovaCena != null ? Number(p.nakladovaCena) : null },
    ]),
  )
}

/**
 * Nákupní cena nové položky: explicitně poslaná hodnota (vč. null) má přednost,
 * ale jen s oprávněním financeNakupkyEdit (stejně jako PATCH položky). Jinak
 * snapshot z produktu; volný řádek bez produktu → null.
 */
export function resolveNakupniCena(
  bodyValue: unknown,
  product: ProductSnapshot | undefined,
  perms: Pick<Permissions, 'financeNakupkyEdit'>,
): number | null {
  if (bodyValue !== undefined && perms.financeNakupkyEdit) {
    if (bodyValue === null || bodyValue === '') return null
    const n = Number(bodyValue)
    if (!isNaN(n)) return n
  }
  return product?.nakladovaCena ?? null
}
