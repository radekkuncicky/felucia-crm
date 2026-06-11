import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const navsteva = await prisma.servisniNavsteva.findFirst({ where: { id: params.id, orgId } })
  if (!navsteva) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Validate technikId belongs to this org when changing it
  if (body.technikId) {
    const technik = await prisma.user.findFirst({ where: { id: body.technikId, orgId } })
    if (!technik) return NextResponse.json({ error: 'Technik nenalezen' }, { status: 400 })
  }

  const updated = await prisma.servisniNavsteva.update({
    where: { id: params.id },
    data: {
      stav: body.stav ?? navsteva.stav,
      typ: body.typ ?? navsteva.typ,
      technikId: body.technikId !== undefined ? (body.technikId || null) : navsteva.technikId,
      poznamka: body.poznamka !== undefined ? body.poznamka : navsteva.poznamka,
      zprava: body.zprava !== undefined ? body.zprava : navsteva.zprava,
      nalezeneZavady: body.nalezeneZavady !== undefined ? body.nalezeneZavady : navsteva.nalezeneZavady,
      doporuceni: body.doporuceni !== undefined ? body.doporuceni : navsteva.doporuceni,
      trvaniMinut: body.trvaniMinut !== undefined ? body.trvaniMinut : navsteva.trvaniMinut,
      nakladyCas: body.nakladyCas !== undefined ? body.nakladyCas : navsteva.nakladyCas,
      nakladyMaterial: body.nakladyMaterial !== undefined ? body.nakladyMaterial : navsteva.nakladyMaterial,
      skutecnyTermin: body.skutecnyTermin !== undefined
        ? (body.skutecnyTermin ? new Date(body.skutecnyTermin) : null)
        : navsteva.skutecnyTermin,
      planovanyTermin: body.planovanyTermin ? new Date(body.planovanyTermin) : navsteva.planovanyTermin,
    },
  })

  return NextResponse.json(updated)
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  // POST to /api/servis/navstevy/[kontraktId] to add a manual visit
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const kontrakt = await prisma.servisniKontrakt.findFirst({ where: { id: params.id, orgId } })
  if (!kontrakt) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  const year = new Date().getFullYear().toString().slice(2)
  const count = await prisma.servisniNavsteva.count({ where: { orgId } })
  const cisloNavstevy = `SN-${year}-${String(count + 1).padStart(3, '0')}`

  const navsteva = await prisma.servisniNavsteva.create({
    data: {
      orgId,
      kontraktId: params.id,
      cisloNavstevy,
      typ: body.typ || 'PLANOVANY_SERVIS',
      planovanyTermin: new Date(body.planovanyTermin),
      technikId: body.technikId || null,
      poznamka: body.poznamka ?? null,
    },
  })

  return NextResponse.json(navsteva, { status: 201 })
}
