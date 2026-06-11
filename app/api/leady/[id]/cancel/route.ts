import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const lead = await db.lead.findFirst({ where: { id: params.id, orgId } })
  if (!lead) return NextResponse.json({ error: 'Nenalezeno' }, { status: 404 })
  if (lead.status === 'PREVEDEN') return NextResponse.json({ error: 'Převedený lead nelze zrušit.' }, { status: 400 })

  const { duvodZruseni } = await req.json()

  const updated = await db.lead.update({
    where: { id: params.id },
    data: { status: 'ZRUSEN', duvodZruseni: duvodZruseni || null },
  })

  return NextResponse.json(updated)
}
