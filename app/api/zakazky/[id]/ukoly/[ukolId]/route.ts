import { getServerSession, type Session } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { parseUkolInput, UKOL_SELECT } from '@/lib/zakazkaUkol'
import { getPerms } from '@/lib/permissions'

async function guard(session: Session | null, zakazkaId: string) {
  if (!session) return { err: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!(await canAccessZakazka(session.user, getPerms(session.user), zakazkaId))) {
    return { err: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { err: null }
}

/** PATCH: částečný update polí + přepnutí `hotovo` (zapisuje hotovoAt/hotovoId). */
export async function PATCH(req: Request, { params }: { params: { id: string; ukolId: string } }) {
  const session = await getServerSession(authOptions)
  const { err } = await guard(session, params.id)
  if (err) return err

  const orgId = session!.user.orgId
  const db = orgPrisma(orgId)
  const existing = await db.zakazkaUkol.findFirst({ where: { id: params.ukolId, zakazkaId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const b = (body ?? {}) as Record<string, unknown>

  const parsed = parseUkolInput(b, { partial: true })
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })

  if (parsed.data.resitelId) {
    const u = await db.user.findFirst({ where: { id: parsed.data.resitelId, orgId, aktivni: true }, select: { id: true } })
    if (!u) return NextResponse.json({ error: 'Řešitel nenalezen' }, { status: 400 })
  }

  const data: Record<string, unknown> = { ...parsed.data }
  if (typeof b.hotovo === 'boolean') {
    data.hotovo = b.hotovo
    data.hotovoAt = b.hotovo ? new Date() : null
    data.hotovoId = b.hotovo ? session!.user.id : null
  }
  if (typeof b.poradi === 'number' && Number.isInteger(b.poradi)) data.poradi = b.poradi

  const ukol = await db.zakazkaUkol.update({ where: { id: params.ukolId }, data, select: UKOL_SELECT })
  return NextResponse.json(ukol)
}

export async function DELETE(req: Request, { params }: { params: { id: string; ukolId: string } }) {
  const session = await getServerSession(authOptions)
  const { err } = await guard(session, params.id)
  if (err) return err

  const db = orgPrisma(session!.user.orgId)
  const existing = await db.zakazkaUkol.findFirst({ where: { id: params.ukolId, zakazkaId: params.id } })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await db.zakazkaUkol.delete({ where: { id: params.ukolId } })
  return NextResponse.json({ ok: true })
}
