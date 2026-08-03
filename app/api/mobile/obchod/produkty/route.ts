import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'

/**
 * GET /api/mobile/obchod/produkty — katalog pro konfigurátor nabídky.
 * ?q= fulltext (název, kód, produktová řada), ?nedavne=1 naposledy použité
 * položky obchodníka (z jeho posledních nabídek). Vrací i nakladovaCena —
 * endpoint je jen pro OBCHODNIK/ADMIN, appka ji drží za přepínačem
 * "režim obchodníka" mimo klientský náhled.
 */
export async function GET(req: Request) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)
  const { searchParams } = new URL(req.url)
  const q = (searchParams.get('q') ?? '').trim()
  const nedavne = searchParams.get('nedavne') === '1'

  if (nedavne) {
    // Naposledy použité produkty: z položek nabídek na OP tohoto obchodníka
    const items = await db.quoteItem.findMany({
      where: { productId: { not: null }, deal: { orgId, userId } },
      select: { productId: true, id: true },
      orderBy: { id: 'desc' },
      take: 200,
    })
    const ids: string[] = []
    for (const i of items) {
      if (i.productId && !ids.includes(i.productId)) ids.push(i.productId)
      if (ids.length >= 20) break
    }
    const produkty = await db.product.findMany({
      where: { id: { in: ids }, aktivni: true },
    })
    const poradi = new Map(ids.map((id, idx) => [id, idx]))
    produkty.sort((a, b) => (poradi.get(a.id) ?? 99) - (poradi.get(b.id) ?? 99))
    return NextResponse.json(produkty.map(mapProdukt))
  }

  const produkty = await db.product.findMany({
    where: {
      aktivni: true,
      ...(q
        ? {
            OR: [
              { nazev: { contains: q, mode: 'insensitive' } },
              { kod: { contains: q, mode: 'insensitive' } },
              { produktovaRada: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: { nazev: 'asc' },
    take: 50,
  })

  return NextResponse.json(produkty.map(mapProdukt))
}

function mapProdukt(p: {
  id: string
  kod: string | null
  nazev: string
  produktovaRada: string | null
  jednotka: string
  dphSazba: number
  standardniCena: unknown
  nakladovaCena: unknown
}) {
  return {
    id: p.id,
    kod: p.kod,
    nazev: p.nazev,
    produktovaRada: p.produktovaRada,
    jednotka: p.jednotka,
    dphSazba: p.dphSazba,
    cena: Number(p.standardniCena),
    nakladovaCena: p.nakladovaCena != null ? Number(p.nakladovaCena) : null,
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
