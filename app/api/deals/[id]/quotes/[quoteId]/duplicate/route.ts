import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateQuoteKod } from '@/lib/quoteKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'

export async function POST(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
    include: { items: { orderBy: { poradi: 'asc' } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newQuote = await createWithUniqueKod(() => generateQuoteKod(orgId), kod => db.quote.create({
    data: {
      orgId,
      dealId: params.id,
      kod,
      nazev: `${quote.nazev} (kopie)`,
      popis: quote.popis,
      dphSazba: quote.dphSazba,
      aktivni: false,
      items: {
        create: quote.items.map((item) => ({
          dealId: params.id,
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

  return NextResponse.json(newQuote, { status: 201 })
}
