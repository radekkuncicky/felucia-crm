import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const body = await req.json()
  const count = await prisma.customField.count({ where: { orgId, entityType: body.entityType } })

  const field = await prisma.customField.create({
    data: {
      orgId,
      entityType: body.entityType,
      nazev: body.nazev,
      typ: body.typ ?? 'TEXT',
      povinne: body.povinne ?? false,
      povinneOdStavu: body.povinneOdStavu || null,
      poradi: count,
      aktivni: true,
    },
  })
  return NextResponse.json(field, { status: 201 })
}
