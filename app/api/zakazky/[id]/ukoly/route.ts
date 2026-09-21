import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { parseUkolInput, UKOL_ORDER_BY, UKOL_SELECT } from '@/lib/zakazkaUkol'
import { getPerms } from '@/lib/permissions'

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const ukoly = await orgPrisma(orgId).zakazkaUkol.findMany({
    where: { zakazkaId: params.id },
    orderBy: UKOL_ORDER_BY,
    select: UKOL_SELECT,
  })
  return NextResponse.json(ukoly)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const parsed = parseUkolInput(body)
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (parsed.data.resitelId) {
    const u = await db.user.findFirst({ where: { id: parsed.data.resitelId, orgId, aktivni: true }, select: { id: true } })
    if (!u) return NextResponse.json({ error: 'Řešitel nenalezen' }, { status: 400 })
  }

  const last = await db.zakazkaUkol.aggregate({ where: { zakazkaId: params.id }, _max: { poradi: true } })
  const ukol = await db.zakazkaUkol.create({
    data: {
      orgId,
      zakazkaId: params.id,
      vytvorilId: session.user.id,
      poradi: (last._max.poradi ?? 0) + 1,
      ...parsed.data,
    },
    select: UKOL_SELECT,
  })
  return NextResponse.json(ukol, { status: 201 })
}
