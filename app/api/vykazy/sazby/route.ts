import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { canEditSazbyVykazu, getPerms } from '@/lib/permissions'
import { doplnSazbyOtevrenym, parseSazba } from '@/lib/vykazPrace'

// PATCH /api/vykazy/sazby { userId, sazbaHodina?, sazbaKm? } — sazby technika nastavuje firma.
// Nová sazba se doplní do otevřených výjezdů, které sazbu zatím nemají; nasnapshotované a uzavřené se nemění.
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canEditSazbyVykazu(getPerms(session.user))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const userId = typeof body?.userId === 'string' ? body.userId : ''
  if (!userId) return NextResponse.json({ error: 'Chybí uživatel' }, { status: 400 })

  const data: { sazbaHodina?: number | null; sazbaKm?: number | null } = {}
  for (const key of ['sazbaHodina', 'sazbaKm'] as const) {
    if (!(key in body)) continue
    const v = parseSazba(body[key])
    if (v === 'chyba') return NextResponse.json({ error: 'Neplatná sazba' }, { status: 400 })
    data[key] = v
  }

  const { orgId } = session.user
  const db = orgPrisma(orgId)
  const res = await db.user.updateMany({ where: { id: userId, orgId }, data })
  if (res.count === 0) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 404 })
  const doplneno = await doplnSazbyOtevrenym(db, orgId, userId, data)

  const u = await db.user.findFirst({ where: { id: userId, orgId }, select: { sazbaHodina: true, sazbaKm: true } })
  return NextResponse.json({
    sazbaHodina: u?.sazbaHodina == null ? null : Number(u.sazbaHodina),
    sazbaKm: u?.sazbaKm == null ? null : Number(u.sazbaKm),
    doplneno,
  })
}
