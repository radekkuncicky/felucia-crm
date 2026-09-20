import { getServerSession } from 'next-auth'
import { logAction } from '@/lib/auditLog'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json()
  const allowed = ['plan', 'aktivni', 'planActiveTo', 'stripeCustomerId']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) data[key] = body[key]
  }

  const before = await prisma.organization.findUnique({ where: { id: params.id }, select: { plan: true, aktivni: true, planActiveTo: true, nazev: true } })
  const org = await prisma.organization.update({ where: { id: params.id }, data })
  await logAction({
    orgId: session.user.orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'SuperadminOrg',
    zaznamId: org.id, zaznamNazev: org.nazev, zmeny: { pred: before, po: data },
  })
  return NextResponse.json(org)
}

export async function DELETE(_: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const org = await prisma.organization.findUnique({ where: { id: params.id }, select: { nazev: true, slug: true } })
  await prisma.organization.delete({ where: { id: params.id } })
  await logAction({
    orgId: session.user.orgId, userId: session.user.id, typAkce: 'DELETE', typZaznamu: 'SuperadminOrg',
    zaznamId: params.id, zaznamNazev: org?.nazev ?? params.id, zmeny: { slug: org?.slug },
  })
  return NextResponse.json({ ok: true })
}
