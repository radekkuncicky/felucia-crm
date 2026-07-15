import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { logSodUdalost } from '@/lib/sodPodpis'

// Storno smlouvy (nepodepsané) — zneplatní aktivní odkaz a označí stav.
// Opětovné „Odeslat k podpisu" smlouvu ze storna zase oživí.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sod = await db.sod.findFirst({ where: { id: params.id, orgId }, select: { id: true, stav: true } })
  if (!sod) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (sod.stav === 'PODEPSANO') {
    return NextResponse.json({ error: 'Podepsanou smlouvu nelze stornovat' }, { status: 422 })
  }
  if (sod.stav === 'STORNO') return NextResponse.json({ ok: true })

  await db.$transaction(async tx => {
    await tx.sodPodpisRelace.updateMany({
      where: { sodId: sod.id, stav: 'AKTIVNI' },
      data: { stav: 'ZNEPLATNENA' },
    })
    await tx.sod.update({ where: { id: sod.id }, data: { stav: 'STORNO' } })
  })
  await logSodUdalost({ orgId, sodId: sod.id, typ: 'STORNO', userId: session.user.id, req })

  return NextResponse.json({ ok: true })
}
