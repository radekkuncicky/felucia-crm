import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { priraditTechnikaKZakazce, odebratTechnikaZeZakazky } from '@/lib/techniciZakazky'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { technikId } = await req.json()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const technik = await db.user.findFirst({ where: { id: technikId, orgId }, select: { id: true, jmeno: true, email: true } })
  if (!technik) return NextResponse.json({ error: 'Technik nenalezen' }, { status: 400 })

  const { zakazkaNovyStav } = await priraditTechnikaKZakazce(db, { orgId, userId: session.user.id, zakazka, technikId })

  return NextResponse.json({ zakazkaId: params.id, technikId, technik, zakazkaNovyStav }, { status: 201 })
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { technikId } = await req.json()

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await odebratTechnikaZeZakazky(db, params.id, technikId)

  return NextResponse.json({ ok: true })
}
