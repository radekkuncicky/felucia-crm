import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Technologie } from '@prisma/client'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const templates = await db.quoteTemplate.findMany({
    where: { orgId },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { nazev, popis, technologie, polozky } = body

  if (!nazev) {
    return NextResponse.json({ error: 'Název je povinný' }, { status: 400 })
  }

  const template = await db.quoteTemplate.create({
    data: {
      orgId,
      nazev,
      popis: popis || null,
      technologie: technologie ? (technologie as Technologie) : null,
      polozky: polozky ?? [],
    },
  })

  return NextResponse.json(template, { status: 201 })
}
