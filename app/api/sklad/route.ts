import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { SkladPohybTyp } from '@prisma/client'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const { searchParams } = new URL(req.url)
  const search = searchParams.get('search')
  const typ = searchParams.get('typ') as SkladPohybTyp | null
  const zakazkaId = searchParams.get('zakazkaId')
  const od = searchParams.get('od')
  const do_ = searchParams.get('do')

  const where: Record<string, unknown> = { orgId }
  if (typ) where.typ = typ
  if (zakazkaId) where.zakazkaId = zakazkaId
  if (search) where.nazev = { contains: search, mode: 'insensitive' }
  if (od || do_) {
    where.vytvoreno = {
      ...(od ? { gte: new Date(od) } : {}),
      ...(do_ ? { lte: new Date(do_ + 'T23:59:59') } : {}),
    }
  }

  const pohyby = await prisma.skladPohyb.findMany({
    where,
    include: {
      zakazka: { select: { id: true, cislo: true, nazev: true } },
      vytvoril: { select: { id: true, jmeno: true } },
    },
    orderBy: { vytvoreno: 'desc' },
    take: 200,
  })

  // KPI aggregates
  const now = new Date()
  const mesicZacatek = new Date(now.getFullYear(), now.getMonth(), 1)

  const [rezervaceTotal, vydejMesic, pocetPohybu] = await Promise.all([
    prisma.skladPohyb.aggregate({
      where: { orgId, typ: 'REZERVACE' },
      _sum: { nakupniCena: true, mnozstvi: true },
    }),
    prisma.skladPohyb.aggregate({
      where: { orgId, typ: 'VYDEJ', vytvoreno: { gte: mesicZacatek } },
      _sum: { nakupniCena: true },
    }),
    prisma.skladPohyb.count({ where: { orgId } }),
  ])

  return NextResponse.json({
    pohyby,
    kpi: {
      rezervaceHodnota: Number(rezervaceTotal._sum.nakupniCena ?? 0),
      vydejMesicHodnota: Number(vydejMesic._sum.nakupniCena ?? 0),
      pocetPohybu,
    },
  })
}
