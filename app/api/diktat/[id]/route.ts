import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { DIKTAT_WHERE, parseDiktatDatum, parseDiktatText, pripojDiktat } from '@/lib/diktat'

/**
 * PATCH /api/diktat/[id] — úprava nezpracovaného diktátu:
 * { text?, datum?, hotovo? } nebo připojení { dealId } / { leadId }.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const diktat = await db.activity.findFirst({ where: { id: params.id, orgId, ...DIKTAT_WHERE }, select: { id: true } })
  if (!diktat) return NextResponse.json({ error: 'Diktát nenalezen nebo už je zpracovaný' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  if (typeof body.dealId === 'string' || typeof body.leadId === 'string') {
    if (typeof body.leadId === 'string' && session.user.plan === 'STARTER') return forbidden('Nedostupné v tomto plánu.')
    const chyba = await pripojDiktat(db, orgId, params.id, typeof body.dealId === 'string' ? { dealId: body.dealId } : { leadId: body.leadId })
    if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })
    return NextResponse.json({ ok: true })
  }

  const data: { popis?: string; datum?: Date; stav?: 'DOKONCENA' | 'PLANOVANA'; splneno?: boolean } = {}
  if (body.text !== undefined) {
    const text = parseDiktatText(body.text)
    if (!text) return NextResponse.json({ error: 'Diktát je prázdný' }, { status: 400 })
    data.popis = text
  }
  if (body.datum !== undefined) {
    const datum = parseDiktatDatum(body.datum)
    if (!datum) return NextResponse.json({ error: 'Neplatné datum' }, { status: 400 })
    data.datum = datum
  }
  if (typeof body.hotovo === 'boolean') {
    data.stav = body.hotovo ? 'DOKONCENA' : 'PLANOVANA'
    data.splneno = body.hotovo
  }
  await db.activity.update({ where: { id: params.id }, data })
  return NextResponse.json({ ok: true })
}
