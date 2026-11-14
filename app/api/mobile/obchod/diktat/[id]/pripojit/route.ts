import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { mobileDealScope, getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { DIKTAT_WHERE, pripojDiktat } from '@/lib/diktat'
import { ZAPIS_CIL } from '@/lib/zapisJednani'

// POST /api/mobile/obchod/diktat/[id]/pripojit — { dealId } připojí můj diktát k OP;
// stane se z něj zápis (dokončená schůzka), který jde v detailu OP učesat
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr
  const { orgId, id: userId } = session!.user
  const db = orgPrisma(orgId)

  const body = await req.json().catch(() => ({})) as { dealId?: unknown }
  if (typeof body.dealId !== 'string') return NextResponse.json({ error: 'Chybí dealId' }, { status: 400 })
  const deal = await db.deal.findFirst({ where: { id: body.dealId, ...mobileDealScope(session!) }, select: { id: true } })
  if (!deal) return NextResponse.json({ error: 'Případ nenalezen' }, { status: 404 })
  // jen vlastní diktát
  const muj = await db.activity.findFirst({ where: { id: params.id, userId, ...DIKTAT_WHERE }, select: { id: true } })
  if (!muj) return NextResponse.json({ error: 'Diktát nenalezen nebo už je zpracovaný' }, { status: 404 })

  const chyba = await pripojDiktat(db, orgId, params.id, { dealId: deal.id })
  if (chyba) return NextResponse.json({ error: chyba }, { status: 409 })
  await db.activity.update({ where: { id: params.id }, data: { typ: 'SCHUZKA', cil: ZAPIS_CIL } })
  return NextResponse.json({ ok: true, aktivitaId: params.id })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
