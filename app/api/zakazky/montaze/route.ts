import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden, zakazkyScopeWhere } from '@/lib/permissions'
import { montazeVRozsahu } from '@/lib/montazeVRozsahu'

const DEN = /^\d{4}-\d{2}-\d{2}$/
const MAX_DNI = 62

// GET ?od=YYYY-MM-DD&do=YYYY-MM-DD&bez=<zakazkaId> — montáže v rozsahu (obsazenost techniků)
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  const scope = zakazkyScopeWhere(perms, session.user.id)
  if (!scope) return forbidden()

  const url = new URL(req.url)
  const od = url.searchParams.get('od') ?? ''
  const doo = url.searchParams.get('do') || od
  if (!DEN.test(od) || !DEN.test(doo) || doo < od) {
    return NextResponse.json({ error: 'Neplatný rozsah dnů' }, { status: 400 })
  }
  if ((Date.parse(doo) - Date.parse(od)) / 86_400_000 > MAX_DNI) {
    return NextResponse.json({ error: `Rozsah max. ${MAX_DNI} dní` }, { status: 400 })
  }

  const orgId = session.user.orgId
  const montaze = await montazeVRozsahu(orgPrisma(orgId), {
    orgId, scope, od, do: doo, bezZakazkyId: url.searchParams.get('bez'),
  })
  return NextResponse.json(montaze)
}
