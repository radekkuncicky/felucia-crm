import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

// DELETE: disconnect one product from category
export async function DELETE(_req: Request, { params }: { params: { id: string; productId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cat = await db.category.findFirst({ where: { id: params.id, orgId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.category.update({
    where: { id: params.id },
    data: { products: { disconnect: { id: params.productId } } },
  })
  return NextResponse.json({ ok: true })
}
