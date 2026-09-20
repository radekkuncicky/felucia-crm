import type { OrgPrismaClient } from './orgPrisma'

/**
 * Ověření, že záznam odkazovaný cizím klíčem z těla requestu patří téže org.
 *
 * orgPrisma i RLS hlídají orgId zapisovaného řádku, ale FK (`clientId`,
 * `dealId`, `zarizeniId`…) se do něj zapíše, jak přišel — PostgreSQL kontroly
 * referenční integrity RLS obcházejí (viz tests/rls.test.ts). Bez téhle
 * kontroly by org A mohla navázat OP/kontrakt/zařízení na klienta org B.
 */
type OwnedModel = 'client' | 'deal' | 'zarizeni' | 'zakazka' | 'user' | 'quoteTemplate' | 'servisniKontrakt'

export async function isOwned(db: OrgPrismaClient, model: OwnedModel, id: string | null | undefined): Promise<boolean> {
  if (!id || typeof id !== 'string') return false
  // orgPrisma doplní orgId do where — cizí záznam prostě nenajde
  const found = await (db[model] as { findFirst: (args: { where: { id: string }; select: { id: true } }) => Promise<{ id: string } | null> })
    .findFirst({ where: { id }, select: { id: true } })
  return !!found
}

/**
 * Pro volitelné FK: `undefined`/`null`/'' projde (vazba se neukládá), jinak
 * musí záznam patřit org. Vrací false = odmítnout request (400/404).
 */
export async function isOwnedOrEmpty(db: OrgPrismaClient, model: OwnedModel, id: string | null | undefined): Promise<boolean> {
  if (!id) return true
  return isOwned(db, model, id)
}
