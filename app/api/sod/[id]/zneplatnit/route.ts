import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { logSodUdalost } from '@/lib/sodPodpis'
import { getPerms, forbidden } from '@/lib/permissions'

// Okamžité zneplatnění odeslaného odkazu (špatný příjemce, revize smlouvy…)
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({ where: { id: params.id, orgId }, select: { id: true, stav: true } })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { count } = await db.sodPodpisRelace.updateMany({
    where: { sodId: sod.id, stav: 'AKTIVNI' },
    data: { stav: 'ZNEPLATNENA' },
  })
  if (sod.stav === 'ODESLANO') {
    await db.sod.update({ where: { id: sod.id }, data: { stav: 'NAVRH' } })
  }
  if (count > 0) {
    await logSodUdalost({ orgId, sodId: sod.id, typ: 'ZNEPLATNENO', userId: session.user.id, req })
  }
  return NextResponse.json({ ok: true, zneplatneno: count })
}
