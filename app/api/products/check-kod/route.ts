import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const kod = searchParams.get('kod')?.trim()
  const excludeId = searchParams.get('excludeId')

  if (!kod) return NextResponse.json({ available: true })

  const existing = await db.product.findFirst({
    where: {
      orgId,
      kod,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
  })

  return NextResponse.json({ available: !existing })
}
