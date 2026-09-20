import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const deal = await db.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Deal nenalezen' }, { status: 404 })

  const sods = await db.sod.findMany({
    where: { dealId: params.id, orgId },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(sods)
}
