import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { getPerms, forbidden } from '@/lib/permissions'
import { maskNakupky } from '@/lib/maskNakupky'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const perms = getPerms(session.user)
  if (!(await canAccessZakazka(session.user, perms, params.id))) return forbidden()

  const zakazka = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const polozky = zakazka.polozky.map(p => ({
    ...p,
    prodejniCena: perms.financeProdejni ? p.prodejniCena : null,
    nakupniCena: perms.financeNakupky ? p.nakupniCena : null,
  }))

  return NextResponse.json(polozky)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const orgSettings = await db.orgSettings.findUnique({ where: { orgId }, select: { zakazkyDefaultDph: true } })
  const count = await db.zakazkaPolozka.count({ where: { zakazkaId: params.id } })
  // productId jen z vlastního katalogu (RLS cizí FK nehlídá)
  const product = body.productId
    ? await db.product.findFirst({ where: { id: body.productId }, select: { id: true } })
    : null

  const polozka = await db.zakazkaPolozka.create({
    data: {
      zakazkaId: params.id,
      nazev: body.nazev,
      kod: body.kod ?? null,
      productId: product?.id ?? null,
      mnozstvi: body.mnozstvi ?? 1,
      jednotka: body.jednotka ?? 'ks',
      prodejniCena: body.prodejniCena ?? null,
      nakupniCena: getPerms(session.user).financeNakupkyEdit ? (body.nakupniCena ?? null) : null,
      dphSazba: body.dphSazba ?? orgSettings?.zakazkyDefaultDph ?? 12,
      poznamka: body.poznamka ?? null,
      poradi: count,
    },
  })

  return NextResponse.json(maskNakupky(polozka, getPerms(session.user)), { status: 201 })
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()
  const { polozkaId, stav, nazev, mnozstvi, jednotka, prodejniCena } = body

  const polozka = await db.zakazkaPolozka.findFirst({
    where: { id: polozkaId, zakazkaId: params.id, zakazka: { orgId } },
  })
  if (!polozka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updated = await db.zakazkaPolozka.update({
    where: { id: polozkaId },
    data: {
      stav: stav ?? undefined,
      nazev: nazev ?? undefined,
      mnozstvi: mnozstvi !== undefined ? mnozstvi : undefined,
      jednotka: jednotka ?? undefined,
      prodejniCena: prodejniCena !== undefined ? prodejniCena : undefined,
    },
  })

  return NextResponse.json(maskNakupky(updated, getPerms(session.user)))
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { polozkaId } = await req.json()

  const polozka = await db.zakazkaPolozka.findFirst({
    where: { id: polozkaId, zakazkaId: params.id, zakazka: { orgId } },
  })
  if (!polozka) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (polozka.stav !== 'CEKA') return NextResponse.json({ error: 'Lze smazat pouze položku ve stavu Čeká' }, { status: 422 })

  await db.zakazkaPolozka.delete({ where: { id: polozkaId } })

  return NextResponse.json({ ok: true })
}
