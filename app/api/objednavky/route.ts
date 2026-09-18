import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden, zakazkyScopeWhere } from '@/lib/permissions'
import { OBJEDNAVKA_INCLUDE, serializeObjednavka } from '@/lib/objednavky'
import type { ObjednavkaStav } from '@prisma/client'

/** Všechny objednávky org (přehled na /sklad). Filtry: ?stav=&dodavatelId=&otevrene=1 */
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const sp = new URL(req.url).searchParams
  const stav = sp.get('stav') as ObjednavkaStav | null
  const dodavatelId = sp.get('dodavatelId')
  const otevrene = sp.get('otevrene') === '1'
  // Objednávky vázané na zakázku respektují rozsah zakázek uživatele; volné vidí každý se skladem
  const scope = zakazkyScopeWhere(perms, session.user.id)

  const rows = await orgPrisma(orgId).objednavka.findMany({
    where: {
      orgId,
      ...(stav ? { stav } : {}),
      ...(otevrene ? { stav: { in: ['NAVRH', 'ODESLANA', 'CASTECNE_DORUCENA'] } } : {}),
      ...(dodavatelId ? { dodavatelId } : {}),
      ...(scope === null ? { zakazkaId: null } : scope && Object.keys(scope).length ? { OR: [{ zakazkaId: null }, { zakazka: scope }] } : {}),
    },
    include: OBJEDNAVKA_INCLUDE,
    orderBy: { vytvoreno: 'desc' },
    take: 300,
  })
  return NextResponse.json(rows.map(o => serializeObjednavka(o, perms.financeNakupky)))
}
