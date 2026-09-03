import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { SkladPohybTyp } from '@prisma/client'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
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

  const pohyby = await db.skladPohyb.findMany({
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
    db.skladPohyb.aggregate({
      where: { orgId, typ: 'REZERVACE' },
      _sum: { nakupniCena: true, mnozstvi: true },
    }),
    db.skladPohyb.aggregate({
      where: { orgId, typ: 'VYDEJ', vytvoreno: { gte: mesicZacatek } },
      _sum: { nakupniCena: true },
    }),
    db.skladPohyb.count({ where: { orgId } }),
  ])

  // Nákupní ceny jen s oprávněním financeNakupky
  const showNakupky = perms.financeNakupky
  return NextResponse.json({
    pohyby: showNakupky ? pohyby : pohyby.map(p => ({ ...p, nakupniCena: null })),
    kpi: {
      rezervaceHodnota: showNakupky ? Number(rezervaceTotal._sum.nakupniCena ?? 0) : 0,
      vydejMesicHodnota: showNakupky ? Number(vydejMesic._sum.nakupniCena ?? 0) : 0,
      pocetPohybu,
    },
  })
}
