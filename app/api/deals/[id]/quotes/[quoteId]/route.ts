import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { isOwned } from '@/lib/ownership'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; quoteId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  if (body.templateId && !(await isOwned(db, 'quoteTemplate', body.templateId))) {
    return NextResponse.json({ error: 'Šablona nenalezena' }, { status: 404 })
  }

  // If setting as active, deactivate all others first
  if (body.aktivni === true) {
    await db.quote.updateMany({ where: { dealId: params.id, id: { not: params.quoteId } }, data: { aktivni: false } })
  }

  const updated = await db.quote.update({
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
  if (!(await canAccessDeal(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const quote = await db.quote.findFirst({
    where: { id: params.quoteId, deal: { id: params.id, orgId } },
  })
  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.quote.delete({ where: { id: params.quoteId } })
  return NextResponse.json({ ok: true })
}
