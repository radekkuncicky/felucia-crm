import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

// POST: connect products to category
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const cat = await db.category.findFirst({ where: { id: params.id, orgId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { productIds } = await req.json() as { productIds: string[] }
  if (!Array.isArray(productIds)) return NextResponse.json({ error: 'productIds required' }, { status: 400 })

  await db.category.update({
    where: { id: params.id },
    data: { products: { connect: productIds.map(id => ({ id })) } },
  })
  return NextResponse.json({ ok: true })
}
