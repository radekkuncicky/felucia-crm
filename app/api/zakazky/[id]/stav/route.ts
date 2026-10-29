import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { jeZakazkaStav, zmenStavZakazky } from '@/lib/zakazkaStav'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const { stav } = await req.json()

  if (!stav) return NextResponse.json({ error: 'Chybí stav' }, { status: 400 })
  if (!jeZakazkaStav(stav)) return NextResponse.json({ error: 'Neplatný stav' }, { status: 422 })

  const r = await zmenStavZakazky(db, { orgId, userId: session.user.id, zakazkaId: params.id, stav })
  if (!r.ok) return NextResponse.json({ error: r.status === 404 ? 'Not found' : r.chyba }, { status: r.status })

  return NextResponse.json(r.zakazka)
}
