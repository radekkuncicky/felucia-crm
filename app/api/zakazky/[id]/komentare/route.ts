import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { getPerms } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const komentare = await db.zakazkaKomentar.findMany({
    where: { zakazkaId: params.id },
    include: { user: { select: { id: true, jmeno: true, role: true } } },
    orderBy: { vytvoreno: 'asc' },
  })

  return NextResponse.json(komentare)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { text } = await req.json()
  if (!text?.trim()) return NextResponse.json({ error: 'Text je povinný' }, { status: 400 })

  const komentar = await db.zakazkaKomentar.create({
    data: { zakazkaId: params.id, userId: session.user.id, text: text.trim() },
    include: { user: { select: { id: true, jmeno: true, role: true } } },
  })

  return NextResponse.json(komentar, { status: 201 })
}
