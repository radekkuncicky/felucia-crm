import type { OrgPrismaClient } from './orgPrisma'
import { getDefiniceProZamereni, vyplneneSekce, type ZamereniSekceOdpovedi } from './zamereniDefinice'

/**
 * Zaměření OP pro zobrazení (detail OP → Zaměření, zakázka → Podklady,
 * mobilní API techniků): vyplněné odpovědi po sekcích + fotky. Jen čtení.
 */
export interface ZamereniPrehled {
  id: string
  typ: string
  stav: string
  datum: string
  autor: string | null
  adresa: string | null
  sekce: ZamereniSekceOdpovedi[]
  fotky: { id: string; url: string; tag: string; popis: string | null }[]
}

export async function nactiZamereniPrehled(
  db: OrgPrismaClient,
  orgId: string,
  dealId: string,
  adresa: string | null,
): Promise<ZamereniPrehled[]> {
  const zamereni = await db.zamereni.findMany({
    where: { orgId, dealId },
    include: { autor: { select: { jmeno: true } }, fotky: { orderBy: { poradi: 'asc' } } },
    orderBy: { vytvoreno: 'desc' },
  })
  return Promise.all(zamereni.map(async z => {
    const definice = await getDefiniceProZamereni(db, z)
    return {
      id: z.id,
      typ: z.typ,
      stav: z.stav,
      datum: z.datum.toISOString(),
      autor: z.autor?.jmeno ?? null,
      adresa,
      sekce: vyplneneSekce(definice.schemaJson, z.odpovedi as Record<string, unknown>),
      fotky: z.fotky.map(f => ({ id: f.id, url: f.url, tag: f.tag, popis: f.popis })),
    }
  }))
}
