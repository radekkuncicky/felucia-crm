import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { items } = await req.json()
  if (!Array.isArray(items)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  await Promise.all(
    items.map(({ id, poradi }: { id: string; poradi: number }) =>
      db.quoteItem.updateMany({ where: { id, quoteId: params.quoteId }, data: { poradi } })
    )
  )

  return NextResponse.json({ ok: true })
}
