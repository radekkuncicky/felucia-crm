import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Technologie } from '@prisma/client'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const template = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(template)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const template = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.quoteTemplate.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? template.nazev,
      popis: body.popis !== undefined ? (body.popis || null) : template.popis,
      technologie: body.technologie !== undefined ? (body.technologie ? (body.technologie as Technologie) : null) : template.technologie,
      polozky: body.polozky !== undefined ? body.polozky : template.polozky,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const template = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.quoteTemplate.delete({ where: { id: params.id } })
  return NextResponse.json({ ok: true })
}
