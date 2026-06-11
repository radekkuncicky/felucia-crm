import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

// POST: connect products to category
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const cat = await prisma.category.findFirst({ where: { id: params.id, orgId } })
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { productIds } = await req.json() as { productIds: string[] }
  if (!Array.isArray(productIds)) return NextResponse.json({ error: 'productIds required' }, { status: 400 })

  await prisma.category.update({
    where: { id: params.id },
    data: { products: { connect: productIds.map(id => ({ id })) } },
  })
  return NextResponse.json({ ok: true })
}
