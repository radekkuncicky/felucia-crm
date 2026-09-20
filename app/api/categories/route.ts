import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const categories = await db.category.findMany({
    where: { orgId },
    orderBy: { poradi: 'asc' },
  })
  return NextResponse.json(categories)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { nazev, barva } = body
  if (!nazev) return NextResponse.json({ error: 'Název je povinný' }, { status: 400 })

  const count = await db.category.count({ where: { orgId } })
  const cat = await db.category.create({
    data: { orgId, nazev, barva: barva || '#6B7280', poradi: count },
  })
  return NextResponse.json(cat, { status: 201 })
}
