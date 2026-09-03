import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { updateServisniZakazka, createServisniZakazka } from '@/lib/servisZakazkaService'
import { forbidden, getPerms, servisScopeWhere } from '@/lib/permissions'

// PATCH /api/servis/zakazky/[id] - úprava zakázky (stav, výsledek, náklady...).
// Přechody stavů hlídá service; admin může poslat forceStav: true (ruční přepis).
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const perms = getPerms(session.user)
  const scope = servisScopeWhere(perms, session.user.id)
  if (!scope) return forbidden()

  const body = await req.json()
  const forceStav = body.forceStav === true && perms.servisDispecink
  delete body.forceStav
  // Přeplánování / přiřazení technika = dispečink (klient posílá celý formulář, takže jen ignorujeme)
  if (!perms.servisDispecink) {
    delete body.technikId
    delete body.planovanyTermin
  }

  const res = await updateServisniZakazka(orgId, params.id, body, { forceStav, scope })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data)
}

// POST /api/servis/zakazky/[id] - přidá ruční zakázku k tomuto kontraktu ([id] = kontraktId).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const res = await createServisniZakazka(orgId, { ...body, kontraktId: params.id })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data, { status: 201 })
}
