import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId

  const body = await req.json()
  const updated = await prisma.organization.update({
    where: { id: orgId },
    data: {
      nazev: body.nazev || undefined,
      ico: body.ico || null,
      dic: body.dic || null,
      sidlo: body.sidlo || null,
      telefon: body.telefon || null,
      email: body.email || null,
      web: body.web || null,
      logo: body.logo || null,
    },
  })
  return NextResponse.json(updated)
}
