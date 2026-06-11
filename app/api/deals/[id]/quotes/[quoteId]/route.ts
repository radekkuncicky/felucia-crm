import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // If setting as active, deactivate all others first
  if (body.aktivni === true) {
    await prisma.quote.updateMany({ where: { dealId: params.id, id: { not: params.quoteId } }, data: { aktivni: false } })
  }

  const updated = await prisma.quote.update({
    where: { id: params.quoteId },
    data: {
      nazev: body.nazev ?? quote.nazev,
      popis: body.popis !== undefined ? body.popis : quote.popis,
      dphSazba: body.dphSazba !== undefined ? Number(body.dphSazba) : quote.dphSazba,
      aktivni: body.aktivni !== undefined ? body.aktivni : quote.aktivni,
      templateId: body.templateId !== undefined ? (body.templateId || null) : quote.templateId,
    },
    include: { items: { include: { product: true } } },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const quote = await prisma.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.quote.delete({ where: { id: params.quoteId } })
  return NextResponse.json({ ok: true })
}
