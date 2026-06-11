import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { orgId } = session.user

  const [usageAgg, orgSettings] = await Promise.all([
    prisma.document.aggregate({ where: { orgId }, _sum: { velikost: true } }),
    prisma.orgSettings.findUnique({ where: { orgId }, select: { storageLimit: true } }),
  ])

  const used = usageAgg._sum.velikost ?? BigInt(0)
  const limit = orgSettings?.storageLimit ?? BigInt(3 * 1024 * 1024 * 1024)

  return NextResponse.json({
    used: used.toString(),
    limit: limit.toString(),
  })
}
