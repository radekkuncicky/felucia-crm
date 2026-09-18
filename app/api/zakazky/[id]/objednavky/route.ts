import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { OBJEDNAVKA_INCLUDE, ObjednavkaChyba, serializeObjednavka, vytvorObjednavkyZeZakazky, type NovaObjednavkaVstup } from '@/lib/objednavky'

/** Objednávky zakázky (záložka Objednávky). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()
  if (!(await canAccessZakazka(session.user, perms, params.id))) return forbidden()

  const orgId = session.user.orgId
  const rows = await orgPrisma(orgId).objednavka.findMany({
    where: { orgId, zakazkaId: params.id },
    include: OBJEDNAVKA_INCLUDE,
    orderBy: { vytvoreno: 'desc' },
  })
  return NextResponse.json(rows.map(o => serializeObjednavka(o, perms.financeNakupky)))
}

/** Hromadné založení: { skupiny: [{ dodavatelId, polozky: [{ zakazkaPolozkaId, mnozstvi }], pozadovanyTermin?, poznamka?, zobrazitCeny? }] } */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad !== 'PLNY') return forbidden()
  if (!(await canAccessZakazka(session.user, perms, params.id))) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const body = await req.json().catch(() => ({}))
  const skupiny = (Array.isArray(body.skupiny) ? body.skupiny : []) as NovaObjednavkaVstup[]
  if (skupiny.length === 0) return NextResponse.json({ error: 'Žádná položka k objednání' }, { status: 400 })
  for (const s of skupiny) {
    if (!s.dodavatelId) return NextResponse.json({ error: 'U každé skupiny položek vyberte dodavatele' }, { status: 400 })
    if (!Array.isArray(s.polozky) || s.polozky.length === 0) return NextResponse.json({ error: 'Skupina bez položek' }, { status: 400 })
  }

  try {
    const ids = await vytvorObjednavkyZeZakazky(db, orgId, session.user.id, params.id, skupiny)
    const rows = await db.objednavka.findMany({ where: { orgId, id: { in: ids } }, include: OBJEDNAVKA_INCLUDE, orderBy: { cislo: 'asc' } })
    return NextResponse.json(rows.map(o => serializeObjednavka(o, perms.financeNakupky)), { status: 201 })
  } catch (e) {
    if (e instanceof ObjednavkaChyba) return NextResponse.json({ error: e.message }, { status: e.status })
    throw e
  }
}
