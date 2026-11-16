import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { dealScopeWhere, forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { DIKTAT_WHERE, diktatScope, parseDiktatDatum, parseDiktatText, pripojDiktat } from '@/lib/diktat'
import { ZAPIS_CIL } from '@/lib/zapisJednani'

/**
 * PATCH /api/diktat/[id] — úprava nezpracovaného diktátu:
 * { text?, datum?, hotovo? } nebo připojení { dealId } / { leadId }.
 * Cizí diktát jen s obchodCiziOP; OP jen v rozsahu uživatele. Diktát z appky
 * Sales (mobileId) se k OP připojí jako zápis z jednání (jde pak učesat AI).
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.obchod) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const diktat = await db.activity.findFirst({
    where: { id: params.id, orgId, ...DIKTAT_WHERE, ...diktatScope(perms, session.user.id) },
    select: { id: true, mobileId: true },
  })
  if (!diktat) return NextResponse.json({ error: 'Diktát nenalezen nebo už je zpracovaný' }, { status: 404 })

  const body = await req.json().catch(() => ({}))

  if (typeof body.dealId === 'string' || typeof body.leadId === 'string') {
    if (typeof body.leadId === 'string' && session.user.plan === 'STARTER') return forbidden('Nedostupné v tomto plánu.')
    if (typeof body.dealId === 'string') {
      const deal = await db.deal.findFirst({ where: { id: body.dealId, orgId, ...dealScopeWhere(perms, session.user.id) }, select: { id: true } })
      if (!deal) return NextResponse.json({ error: 'OP nenalezen' }, { status: 404 })
    }
    const chyba = await pripojDiktat(db, orgId, params.id, typeof body.dealId === 'string' ? { dealId: body.dealId } : { leadId: body.leadId })
    if (chyba) return NextResponse.json({ error: chyba }, { status: 400 })
    if (typeof body.dealId === 'string' && diktat.mobileId) {
      await db.activity.update({ where: { id: params.id }, data: { typ: 'SCHUZKA', cil: ZAPIS_CIL } })
    }
    return NextResponse.json({ ok: true, href: typeof body.dealId === 'string' ? `/deals/${body.dealId}` : `/leady/${body.leadId}` })
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
