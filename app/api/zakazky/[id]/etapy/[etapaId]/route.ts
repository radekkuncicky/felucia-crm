import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string; etapaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const etapa = await prisma.zakazkaEtapa.findFirst({
    where: { id: params.etapaId, zakazkaId: params.id, orgId },
  })
  if (!etapa) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { nazev, montazOd, montazDo, stav, poznamka } = await req.json()

  const updated = await prisma.zakazkaEtapa.update({
    where: { id: params.etapaId },
    data: {
      nazev: nazev !== undefined ? (nazev?.trim() || null) : undefined,
      montazOd: montazOd !== undefined ? (montazOd ? new Date(montazOd) : null) : undefined,
      montazDo: montazDo !== undefined ? (montazDo ? new Date(montazDo) : null) : undefined,
      stav: stav ?? undefined,
      poznamka: poznamka !== undefined ? (poznamka?.trim() || null) : undefined,
    },
    include: {
      predavaky: { select: { id: true, cislo: true, stav: true } },
      vyuctovani: { select: { id: true, cislo: true, stav: true } },
    },
  })

  return NextResponse.json(updated)
}

export async function DELETE(req: Request, { params }: { params: { id: string; etapaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const etapa = await prisma.zakazkaEtapa.findFirst({
    where: { id: params.etapaId, zakazkaId: params.id, orgId },
    include: {
      predavaky: { select: { id: true } },
      vyuctovani: { select: { id: true } },
    },
  })
  if (!etapa) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (etapa.predavaky.length > 0 || etapa.vyuctovani.length > 0) {
    return NextResponse.json({ error: 'Etapu nelze smazat, má přiřazené protokoly nebo vyúčtování' }, { status: 422 })
  }

  await prisma.zakazkaEtapa.delete({ where: { id: params.etapaId } })
  return NextResponse.json({ ok: true })
}
