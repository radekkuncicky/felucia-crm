import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { generateQuoteKod } from '@/lib/quoteKod'

export async function POST(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, dealId: params.id, orgId },
    include: { items: { orderBy: { poradi: 'asc' } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { targetDealId } = body
  if (!targetDealId) return NextResponse.json({ error: 'targetDealId required' }, { status: 400 })

  const targetDeal = await prisma.deal.findFirst({ where: { id: targetDealId, orgId } })
  if (!targetDeal) return NextResponse.json({ error: 'Target deal not found' }, { status: 404 })

  const kod = await generateQuoteKod(orgId)
  const newQuote = await prisma.quote.create({
    data: {
      orgId,
      dealId: targetDealId,
      kod,
      nazev: `Kopie - ${quote.nazev}`,
      popis: quote.popis,
      dphSazba: quote.dphSazba,
      aktivni: false,
      items: {
        create: quote.items.map(item => ({
          dealId: targetDealId,
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
  })

  return NextResponse.json({ dealId: targetDealId, quoteId: newQuote.id })
}
