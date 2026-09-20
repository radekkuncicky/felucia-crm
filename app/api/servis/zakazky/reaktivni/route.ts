import { getPlanLimits } from '@/lib/planLimits'
import { forbidden, getPerms } from '@/lib/permissions'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createServisniZakazka } from '@/lib/servisZakazkaService'

// POST /api/servis/zakazky/reaktivni - reaktivní zakázka (porucha).
// Vzniká bez termínu a bez kontraktu, stav NOVA. Termín a technika doplní dispečink.
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).servisDispecink) return forbidden()
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const { klientId, zarizeniId, typ, poznamka } = body

  const res = await createServisniZakazka(orgId, {
    klientId: klientId || null,
    zarizeniId: zarizeniId || null,
    typ: typ || 'PORUCHA',
    poznamka: poznamka || null,
    kontraktId: null,
    planovanyTermin: null,
    stav: 'NOVA',
  })

  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data, { status: 201 })
}
