import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId

  const etapy = await prisma.zakazkaEtapa.findMany({
    where: { zakazkaId: params.id, orgId },
    orderBy: { cislo: 'asc' },
    include: {
      predavaky: { select: { id: true, cislo: true, stav: true } },
      vyuctovani: { select: { id: true, cislo: true, stav: true } },
    },
  })

  return NextResponse.json(etapy)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const { nazev, montazOd, montazDo, poznamka } = await req.json()

  const zakazka = await prisma.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const last = await prisma.zakazkaEtapa.findFirst({
    where: { zakazkaId: params.id },
    orderBy: { cislo: 'desc' },
  })
  const cislo = (last?.cislo ?? 0) + 1

  const etapa = await prisma.$transaction(async tx => {
    const e = await tx.zakazkaEtapa.create({
      data: {
        orgId,
        zakazkaId: params.id,
        cislo,
        nazev: nazev?.trim() || null,
        montazOd: montazOd ? new Date(montazOd) : null,
        montazDo: montazDo ? new Date(montazDo) : null,
        poznamka: poznamka?.trim() || null,
        stav: 'PLANOVANA',
      },
      include: {
        predavaky: { select: { id: true, cislo: true, stav: true } },
        vyuctovani: { select: { id: true, cislo: true, stav: true } },
      },
    })

    if (zakazka.stav === 'PREDANA') {
      await tx.zakazka.update({
        where: { id: params.id },
        data: { stav: 'V_REALIZACI' },
      })
    }

    return e
  })

  return NextResponse.json(etapa, { status: 201 })
}
