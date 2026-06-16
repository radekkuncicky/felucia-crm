import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const kontrakt = await db.servisniKontrakt.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
      servisniZakazky: {
        include: { technik: { select: { id: true, jmeno: true } } },
        orderBy: { planovanyTermin: 'asc' },
      },
    },
  })

  if (!kontrakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json(kontrakt)
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const kontrakt = await db.servisniKontrakt.findFirst({ where: { id: params.id, orgId } })
  if (!kontrakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const updated = await db.servisniKontrakt.update({
    where: { id: params.id },
    data: {
      nazev: body.nazev ?? kontrakt.nazev,
      aktivni: body.aktivni !== undefined ? body.aktivni : kontrakt.aktivni,
      cena: body.cena !== undefined ? (body.cena ? String(body.cena) : null) : kontrakt.cena,
      poznamka: body.poznamka !== undefined ? body.poznamka : kontrakt.poznamka,
      konec: body.konec !== undefined ? (body.konec ? new Date(body.konec) : null) : kontrakt.konec,
    },
  })

  return NextResponse.json(updated)
}
