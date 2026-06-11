import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const product = await db.product.findFirst({ where: { id: params.id, orgId } })
  if (!product) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const items = await db.quoteItem.findMany({
    where: { productId: params.id, deal: { orgId } },
    include: { deal: { select: { id: true, vytvoreno: true } } },
    orderBy: { deal: { vytvoreno: 'desc' } },
  })

  const totalCount = items.length
  const lastUsed = items.length > 0 ? items[0].deal.vytvoreno.toISOString() : null

  return NextResponse.json({ totalCount, lastUsed })
}
