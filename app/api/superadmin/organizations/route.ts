import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgs = await prisma.organization.findMany({
    orderBy: { vytvoreno: 'desc' },
    include: {
      _count: { select: { users: true, deals: true, clients: true } },
    },
  })

  return NextResponse.json(orgs)
}
