import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const templates = await db.contractTemplate.findMany({
    where: { orgId },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { nazev, obsah } = await req.json()
  if (!nazev) return NextResponse.json({ error: 'nazev required' }, { status: 400 })

  const tpl = await db.contractTemplate.create({
    data: { orgId, nazev, obsah: obsah ?? '' },
  })
  return NextResponse.json(tpl, { status: 201 })
}
