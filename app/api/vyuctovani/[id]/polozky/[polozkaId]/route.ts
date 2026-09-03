import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'

async function getVyuctovani(id: string, orgId: string) {
  return orgPrisma(orgId).vyuctovani.findFirst({ where: { id } })
}

export async function PATCH(req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.zakazkyEdit) return forbidden()

  const v = await getVyuctovani(params.id, session.user.orgId)
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.stav === 'SCHVALENO') return NextResponse.json({ error: 'Schválené vyúčtování nelze měnit' }, { status: 422 })

  const body = await req.json()
  const updated = await orgPrisma(session.user.orgId).vyuctovaniPolozka.update({
    where: { id: params.polozkaId, vyuctovaniId: params.id },
    data: {
      nazev: body.nazev ?? undefined,
      mnozstvi: body.mnozstvi != null ? Number(body.mnozstvi) : undefined,
      jednotka: body.jednotka ?? undefined,
      nakupniCena: perms.financeNakupkyEdit && body.nakupniCena != null ? Number(body.nakupniCena) : undefined,
      prodejniCena: body.prodejniCena != null ? Number(body.prodejniCena) : undefined,
      dphSazba: body.dphSazba != null ? Number(body.dphSazba) : undefined,
      poradi: body.poradi != null ? Number(body.poradi) : undefined,
    },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string; polozkaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const v = await getVyuctovani(params.id, session.user.orgId)
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.stav === 'SCHVALENO') return NextResponse.json({ error: 'Schválené vyúčtování nelze měnit' }, { status: 422 })

  await orgPrisma(session.user.orgId).vyuctovaniPolozka.deleteMany({
    where: { id: params.polozkaId, vyuctovaniId: params.id },
  })
  return NextResponse.json({ ok: true })
}
