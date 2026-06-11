import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const deal = await prisma.deal.findFirst({ where: { id: params.id, orgId } })
  if (!deal) return NextResponse.json({ error: 'Deal nenalezen' }, { status: 404 })

  const sods = await prisma.sod.findMany({
    where: { dealId: params.id, orgId },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(sods)
}
