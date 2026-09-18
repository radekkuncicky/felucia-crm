import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { OBJEDNAVKA_INCLUDE, ObjednavkaChyba, prijmoutDodavku, serializeObjednavka } from '@/lib/objednavky'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'

/** Příjem dodávky: { polozky: [{ id, mnozstvi }] } — částečné dodávky, příjem na sklad + rezervace pro zakázku. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const o = await db.objednavka.findFirst({ where: { id: params.id, orgId }, include: OBJEDNAVKA_INCLUDE })
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (o.zakazkaId && !(await canAccessZakazka(session.user, perms, o.zakazkaId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json().catch(() => ({}))
  if (!Array.isArray(body.polozky)) return NextResponse.json({ error: 'Chybí položky' }, { status: 400 })

  try {
    await prijmoutDodavku(db, orgId, session.user.id, o, body.polozky)
  } catch (e) {
    if (e instanceof ObjednavkaChyba) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
  const fresh = await db.objednavka.findFirst({ where: { id: o.id, orgId }, include: OBJEDNAVKA_INCLUDE })
  return NextResponse.json(serializeObjednavka(fresh!, perms.financeNakupky))
}
