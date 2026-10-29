import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { zkopirujNabidku } from '@/lib/quoteCopy'

export async function POST(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, dealId: params.id, orgId },
    include: { items: { orderBy: { poradi: 'asc' } } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const { targetDealId } = body
  if (!targetDealId) return NextResponse.json({ error: 'targetDealId required' }, { status: 400 })

  const targetDeal = await db.deal.findFirst({ where: { id: targetDealId, orgId } })
  if (!targetDeal) return NextResponse.json({ error: 'Target deal not found' }, { status: 404 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), targetDeal.id))) return forbidden()

  const newQuote = await zkopirujNabidku(db, { orgId, quote, targetDealId, nazev: `Kopie - ${quote.nazev}` })

  return NextResponse.json({ dealId: targetDealId, quoteId: newQuote.id })
}
