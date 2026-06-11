import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const templates = await prisma.contractTemplate.findMany({
    where: { orgId },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const { nazev, obsah } = await req.json()
  if (!nazev) return NextResponse.json({ error: 'nazev required' }, { status: 400 })

  const tpl = await prisma.contractTemplate.create({
    data: { orgId, nazev, obsah: obsah ?? '' },
  })
  return NextResponse.json(tpl, { status: 201 })
}
