import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createReklamace } from '@/lib/servisZakazkaService'

// POST /api/servis/zakazky/[id]/reklamace - založí reklamační zakázku navázanou
// na dokončenou původní (stav NOVA bez termínu -> pool dispečinku).
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json().catch(() => ({}))
  const res = await createReklamace(orgId, params.id, {
    poznamka: typeof body.poznamka === 'string' ? body.poznamka : null,
    typ: typeof body.typ === 'string' ? body.typ : null,
  })
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(res.data, { status: 201 })
}
