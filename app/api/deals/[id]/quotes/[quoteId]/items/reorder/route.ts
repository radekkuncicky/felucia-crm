import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { items } = await req.json()
  if (!Array.isArray(items)) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  await Promise.all(
    items.map(({ id, poradi }: { id: string; poradi: number }) =>
      prisma.quoteItem.update({ where: { id }, data: { poradi } })
    )
  )

  return NextResponse.json({ ok: true })
}
