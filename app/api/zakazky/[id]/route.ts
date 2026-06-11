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
    include: {
      klient: true,
      vedouci: { select: { id: true, jmeno: true, email: true } },
      op: { select: { id: true, kod: true, predmet: true } },
      techniciRel: { include: { technik: { select: { id: true, jmeno: true, email: true } } } },
      polozky: { orderBy: { poradi: 'asc' } },
      predavaky: { orderBy: { vytvoreno: 'desc' }, include: { technik: { select: { id: true, jmeno: true } } } },
      vyuctovani: { orderBy: { vytvoreno: 'desc' } },
      fotky: { orderBy: { vytvoreno: 'desc' } },
    },
  })

  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Strip prodejniCena for technicians
  if (isTechnik) {
    return NextResponse.json({
      ...zakazka,
      polozky: zakazka.polozky.map(p => ({ ...p, prodejniCena: null })),
    })
  }

  return NextResponse.json(zakazka)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json()

  const zakazka = await db.zakazka.update({
    where: { id: params.id, orgId },
    data: {
      stav: body.stav,
      vedouciId: body.vedouciId,
      poznamka: body.poznamka,
      nazev: body.nazev,
      uzavreno: body.stav === 'HOTOVO' ? new Date() : undefined,
      montazOd: body.montazOd !== undefined ? (body.montazOd ? new Date(body.montazOd) : null) : undefined,
      montazDo: body.montazDo !== undefined ? (body.montazDo ? new Date(body.montazDo) : null) : undefined,
    },
  })

  return NextResponse.json(zakazka)
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const zakazka = await db.zakazka.findFirst({ where: { id: params.id, orgId } })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.$transaction([
    // No FK cascade — delete manually
    db.skladPohyb.deleteMany({ where: { zakazkaId: params.id } }),
    db.vyuctovani.deleteMany({ where: { zakazkaId: params.id } }),
    db.predavak.deleteMany({ where: { zakazkaId: params.id } }),
    // FK cascade covers: ZakazkaPolozka, TechnikZakazka, ZakazkaKomentar, ZakazkaFoto
    db.zakazka.delete({ where: { id: params.id } }),
  ])

  return NextResponse.json({ ok: true })
}
