import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { maskNakupky } from '@/lib/maskNakupky'
import { zkopirujNabidku } from '@/lib/quoteCopy'

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

  const newQuote = await zkopirujNabidku(db, { orgId, quote, targetDealId: params.id, nazev: `${quote.nazev} (kopie)` })

  return NextResponse.json(maskNakupky(newQuote, getPerms(session.user)), { status: 201 })
}
