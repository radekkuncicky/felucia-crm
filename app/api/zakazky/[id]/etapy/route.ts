import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { zalozDalsiEtapu } from '@/lib/zakazkaEtapyDb'
import { getPerms, forbidden } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const etapy = await db.zakazkaEtapa.findMany({
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

  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Neplatná data požadavku.' }, { status: 400 })
  }
  const { nazev, montazOd, montazDo, poznamka } = body as Record<string, unknown>

  const result = await zalozDalsiEtapu(db, orgId, params.id, {
    nazev: typeof nazev === 'string' ? nazev.trim() || null : null,
    montazOd: montazOd ? new Date(montazOd as string) : null,
    montazDo: montazDo ? new Date(montazDo as string) : null,
    poznamka: typeof poznamka === 'string' ? poznamka.trim() || null : null,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }
  return NextResponse.json(result.etapa, { status: 201 })
}
