import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const categories = await prisma.category.findMany({
    where: { orgId },
    orderBy: { poradi: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const body = await req.json()
  const { nazev, barva } = body
  if (!nazev) return NextResponse.json({ error: 'Název je povinný' }, { status: 400 })

  const count = await prisma.category.count({ where: { orgId } })
  const cat = await prisma.category.create({
    data: { orgId, nazev, barva: barva || '#6B7280', poradi: count },
  })
  return NextResponse.json(cat, { status: 201 })
}
