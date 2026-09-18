import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { stavSkladu } from '@/lib/sklad'

/**
 * Zůstatky skladu. `?productId=` vrátí jeden produkt (pro modal rezervace),
 * bez parametru všechny produkty s pohybem (tabulka Zásoby).
 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const productId = new URL(req.url).searchParams.get('productId')

  if (productId) {
    const stav = await stavSkladu(db, orgId, [productId])
    return NextResponse.json(stav.get(productId) ?? { naSklade: 0, rezervovano: 0, dostupne: 0 })
  }

  const stav = await stavSkladu(db, orgId)
  const ids = Array.from(stav.keys())
  const products = await db.product.findMany({
    where: { orgId, id: { in: ids } },
    select: { id: true, kod: true, nazev: true, jednotka: true, minMnozstvi: true, nakladovaCena: true },
    orderBy: [{ kod: 'asc' }, { nazev: 'asc' }],
  })
  return NextResponse.json(products.map(p => {
    const s = stav.get(p.id)!
    return {
      ...p,
      minMnozstvi: p.minMnozstvi !== null ? Number(p.minMnozstvi) : null,
      nakladovaCena: perms.financeNakupky && p.nakladovaCena !== null ? Number(p.nakladovaCena) : null,
      ...s,
      hodnota: perms.financeNakupky && p.nakladovaCena !== null ? Math.max(s.naSklade, 0) * Number(p.nakladovaCena) : null,
    }
  }))
}
