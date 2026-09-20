import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { forbidden, getPerms } from '@/lib/permissions'
import { loadProductSnapshots, resolveNakupniCena } from '@/lib/quoteItems'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { nazev, mnozstvi, cenaZaKus, productId, poznamky, nakupniCena } = body

  if (!nazev || !mnozstvi || cenaZaKus === undefined) {
    return NextResponse.json({ error: 'Chybí povinná pole' }, { status: 400 })
  }

  // Snapshot z knihovny produktů (kód, jednotka, nákupní cena pro marži)
  const product = productId ? (await loadProductSnapshots(db, [productId])).get(productId) : undefined

  const item = await db.quoteItem.create({
    data: {
      dealId: params.id,
      productId: product ? productId : null,
      kod: product?.kod ?? null,
      nazev,
      mnozstvi: Number(mnozstvi),
      jednotka: product?.jednotka ?? 'ks',
      cenaZaKus: Number(cenaZaKus),
      nakupniCena: resolveNakupniCena(nakupniCena, product, getPerms(session.user)),
      poznamky: poznamky || null,
    },
    include: { product: true },
  })

  return NextResponse.json(item, { status: 201 })
}
