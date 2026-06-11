import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const item = await db.quoteItem.findFirst({
    where: { id: params.itemId, dealId: params.id, deal: { orgId } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.quoteItem.update({
    where: { id: params.itemId },
    data: {
      nazev: body.nazev ?? item.nazev,
      mnozstvi: body.mnozstvi !== undefined ? Number(body.mnozstvi) : item.mnozstvi,
      cenaZaKus: body.cenaZaKus !== undefined ? Number(body.cenaZaKus) : item.cenaZaKus,
      poznamky: body.poznamky !== undefined ? body.poznamky : item.poznamky,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string; itemId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const item = await db.quoteItem.findFirst({
    where: { id: params.itemId, dealId: params.id, deal: { orgId } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.quoteItem.delete({ where: { id: params.itemId } })
  return NextResponse.json({ ok: true })
}
