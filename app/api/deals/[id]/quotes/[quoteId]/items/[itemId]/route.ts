import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function PATCH(req: Request, { params }: { params: { id: string; quoteId: string; itemId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const item = await db.quoteItem.findFirst({
    where: { id: params.itemId, quoteId: params.quoteId, deal: { orgId } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const updated = await db.quoteItem.update({
    where: { id: params.itemId },
    data: {
      kod: body.kod !== undefined ? (body.kod || null) : item.kod,
      nazev: body.nazev ?? item.nazev,
      mnozstvi: body.mnozstvi !== undefined ? Number(body.mnozstvi) : item.mnozstvi,
      jednotka: body.jednotka !== undefined ? (body.jednotka || 'ks') : item.jednotka,
      cenaZaKus: body.cenaZaKus !== undefined ? Number(body.cenaZaKus) : item.cenaZaKus,
      nakupniCena: body.nakupniCena !== undefined && getPerms(session.user).financeNakupkyEdit
        ? (body.nakupniCena === '' || body.nakupniCena === null ? null : Number(body.nakupniCena))
        : item.nakupniCena,
      sleva: body.sleva !== undefined ? Number(body.sleva) : item.sleva,
      dphSazba: body.dphSazba !== undefined ? Number(body.dphSazba) : item.dphSazba,
      poznamky: body.poznamky !== undefined ? body.poznamky : item.poznamky,
      poradi: body.poradi !== undefined ? Number(body.poradi) : item.poradi,
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string; quoteId: string; itemId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const item = await db.quoteItem.findFirst({
    where: { id: params.itemId, quoteId: params.quoteId, deal: { orgId } },
  })
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.quoteItem.delete({ where: { id: params.itemId } })
  return NextResponse.json({ ok: true })
}
