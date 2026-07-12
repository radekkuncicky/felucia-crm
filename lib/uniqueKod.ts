import { Prisma } from '@prisma/client'

/**
 * Vytvoří záznam s vygenerovaným číslem dokladu a při kolizi
 * (unique constraint na (orgId, kod/cislo), Prisma P2002) číslo
 * přegeneruje a zkusí znovu. Řeší souběžné vytváření — např. Dáša
 * spouštějící dva create nástroje paralelně, dvojklik, dva uživatelé.
 */
export async function createWithUniqueKod<T>(
  generate: () => Promise<string>,
  create: (kod: string) => Promise<T>,
  attempts = 5,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    const kod = await generate()
    try {
      return await create(kod)
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
        lastError = e
        continue
      }
      throw e
    }
  }
  throw lastError
}
