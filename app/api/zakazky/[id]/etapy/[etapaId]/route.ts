import { getServerSession } from 'next-auth'
import { EtapaStav } from '@prisma/client'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

const ETAPA_STAV_VALUES = new Set<string>(Object.values(EtapaStav))

export async function PATCH(req: Request, { params }: { params: { id: string; etapaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const etapa = await db.zakazkaEtapa.findFirst({
    where: { id: params.etapaId, zakazkaId: params.id, orgId },
  })
  if (!etapa) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }
  const { nazev, montazOd, montazDo, stav, poznamka } = body as Record<string, unknown>
  if (stav !== undefined && !ETAPA_STAV_VALUES.has(stav as string)) {
    return NextResponse.json({ error: `Neplatný stav etapy: ${stav}` }, { status: 400 })
  }

  try {
    const updated = await db.zakazkaEtapa.update({
      where: { id: params.etapaId },
      data: {
        nazev: nazev !== undefined ? ((nazev as string)?.trim() || null) : undefined,
        montazOd: montazOd !== undefined ? (montazOd ? new Date(montazOd as string) : null) : undefined,
        montazDo: montazDo !== undefined ? (montazDo ? new Date(montazDo as string) : null) : undefined,
        stav: (stav as EtapaStav) ?? undefined,
        poznamka: poznamka !== undefined ? ((poznamka as string)?.trim() || null) : undefined,
      },
      include: {
        predavaky: { select: { id: true, cislo: true, stav: true } },
        vyuctovani: { select: { id: true, cislo: true, stav: true } },
      },
    })

    return NextResponse.json(updated)
  } catch (e) {
    console.error(`[zakazky/etapy] selhala úprava etapy ${params.etapaId}:`, e)
    return NextResponse.json({ error: 'Úprava etapy se nezdařila, zkuste to prosím znovu.' }, { status: 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string; etapaId: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const role = session.user.role
  if (role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const etapa = await db.zakazkaEtapa.findFirst({
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

  await db.zakazkaEtapa.delete({ where: { id: params.etapaId } })
  return NextResponse.json({ ok: true })
}
