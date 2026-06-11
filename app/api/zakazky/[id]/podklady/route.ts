import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canTechnikAccessZakazka } from '@/lib/zakazkyHelpers'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const isTechnik = session.user.role === 'TECHNIK'

  if (isTechnik && !(await canTechnikAccessZakazka(session.user.id, params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({
    where: { id: params.id, orgId },
    select: { pokyny: true },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const dokumenty = await db.zakázkaDokument.findMany({
    where: { zakazkaId: params.id },
    include: { nahral: { select: { id: true, jmeno: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json({ pokyny: zakazka.pokyny, dokumenty })
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  if (body.pokyny !== undefined) {
    await db.zakazka.update({
      where: { id: params.id },
      data: { pokyny: body.pokyny || null },
    })
    return NextResponse.json({ ok: true })
  }

  if (body.url && body.nazev) {
    const dok = await db.zakázkaDokument.create({
      data: {
        orgId,
        zakazkaId: params.id,
        nazev: body.nazev,
        url: body.url,
        mime: body.mime ?? 'application/octet-stream',
        nahralId: session.user.id,
      },
      include: { nahral: { select: { id: true, jmeno: true } } },
    })
    return NextResponse.json(dok, { status: 201 })
  }

  return NextResponse.json({ error: 'Chybí parametry' }, { status: 400 })
}
