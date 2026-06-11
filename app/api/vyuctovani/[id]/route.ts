import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const v = await db.vyuctovani.findFirst({
    where: { id: params.id, orgId },
    include: {
      polozky: { orderBy: { poradi: 'asc' } },
      zakazka: {
        select: {
          id: true, cislo: true, nazev: true,
          klient: { select: { jmeno: true, prijmeni: true } },
        },
      },
      schvalil: { select: { jmeno: true } },
    },
  })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(v)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const isAdmin = session.user.role === 'ADMIN'
  const v = await db.vyuctovani.findFirst({ where: { id: params.id, orgId } })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Admin can reopen an approved billing
  if (body.stav === 'NAVRH' && isAdmin) {
    const updated = await db.vyuctovani.update({
      where: { id: params.id },
      data: { stav: 'NAVRH', schvaleno: null, schvalenoId: null },
      include: { polozky: { orderBy: { poradi: 'asc' } } },
    })
    return NextResponse.json(updated)
  }

  if (v.stav === 'SCHVALENO') return NextResponse.json({ error: 'Schválené vyúčtování nelze měnit' }, { status: 422 })

  const { poznamka } = body

  const updated = await db.vyuctovani.update({
    where: { id: params.id },
    data: { poznamka: poznamka ?? undefined },
    include: { polozky: { orderBy: { poradi: 'asc' } } },
  })
  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const v = await db.vyuctovani.findFirst({ where: { id: params.id, orgId } })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.vyuctovani.delete({ where: { id: params.id } })

  return NextResponse.json({ ok: true })
}
