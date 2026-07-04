// DEPRECATED alias. Mobilní app felucia-tech volá /api/servis/navstevy a čeká
// starý tvar (ServisStav, cisloNavstevy). Vrací proto data přes legacy shim.
// Nové UI používá /api/servis/zakazky. AŽ se app přepíše, tento soubor SMAZAT.
// TODO(servis-refactor): odstranit po nasazení nové app.
import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { listServisniZakazky, createServisniZakazka } from '@/lib/servisZakazkaService'
import { legacyStavToNew, toLegacyNavsteva } from '@/lib/servisLegacy'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const stavParam = searchParams.get('stav')
  const zakazky = await listServisniZakazky(orgId, {
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    stav: stavParam ? legacyStavToNew(stavParam) : null,
  })
  return NextResponse.json(zakazky.map(toLegacyNavsteva))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  // App nezakládá zakázky bez termínu - termín tu zůstává povinný kvůli kompatibilitě.
  if (!body.planovanyTermin) return NextResponse.json({ error: 'planovanyTermin required' }, { status: 400 })
  if (body.stav) body.stav = legacyStavToNew(body.stav) ?? undefined

  const res = await createServisniZakazka(orgId, body)
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status })
  return NextResponse.json(toLegacyNavsteva(res.data as never), { status: 201 })
}
