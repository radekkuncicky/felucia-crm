import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Technologie } from '@prisma/client'
import { checkQuoteTemplateLimit } from '@/lib/checkPlanLimit'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
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
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { nazev, popis, technologie, polozky } = body

  if (!nazev) {
    return NextResponse.json({ error: 'Název je povinný' }, { status: 400 })
  }

  if (!(await checkQuoteTemplateLimit(orgId))) {
    return NextResponse.json({ error: 'Dosažen limit šablon pro váš plán.', code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
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
