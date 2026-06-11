import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const v = await db.vyuctovani.findFirst({ where: { id: params.id, orgId } })
  if (!v) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (v.stav === 'SCHVALENO') return NextResponse.json({ error: 'Schválené vyúčtování nelze měnit' }, { status: 422 })

  const { nazev, mnozstvi, jednotka, nakupniCena, prodejniCena, dphSazba } = await req.json()
  if (!nazev?.trim()) return NextResponse.json({ error: 'Chybí název' }, { status: 400 })

  const count = await db.vyuctovaniPolozka.count({ where: { vyuctovaniId: params.id } })
  const polozka = await db.vyuctovaniPolozka.create({
    data: {
      vyuctovaniId: params.id,
      nazev,
      mnozstvi: Number(mnozstvi ?? 1),
      jednotka: jednotka ?? 'ks',
      nakupniCena: nakupniCena != null ? Number(nakupniCena) : null,
      prodejniCena: Number(prodejniCena ?? 0),
      dphSazba: Number(dphSazba ?? 21),
      poradi: count,
    },
  })
  return NextResponse.json(polozka, { status: 201 })
}
