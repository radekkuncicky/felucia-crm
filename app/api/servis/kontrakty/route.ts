import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

function generateNavstevy(kontraktId: string, orgId: string, zacatek: Date, konec: Date | null, intervalMesicu: number) {
  const dates: Date[] = []
  const current = new Date(zacatek)
  const end = konec ?? new Date(current.getFullYear() + 5, current.getMonth(), current.getDate())

  while (current < end) {
    dates.push(new Date(current))
    current.setMonth(current.getMonth() + intervalMesicu)
  }

  return dates.map(d => ({
    orgId,
    kontraktId,
    planovanyTermin: d,
    stav: 'PLANOVANA' as const,
  }))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const { dealId, zarizeniId, klientId, nazev, typ, intervalMesicu, cena, zacatek, konec, poznamka, autoRenewal } = body

  if (!klientId || !nazev || !typ || !intervalMesicu || !zacatek) {
    return NextResponse.json({ error: 'Chybí povinné pole' }, { status: 400 })
  }

  // Auto-number: SK-YY-NNN
  const year = new Date().getFullYear().toString().slice(2)
  const count = await prisma.servisniKontrakt.count({ where: { orgId } })
  const cisloKontraktu = `SK-${year}-${String(count + 1).padStart(3, '0')}`

  const kontrakt = await prisma.servisniKontrakt.create({
    data: {
      orgId,
      dealId: dealId || null,
      zarizeniId: zarizeniId || null,
      klientId,
      cisloKontraktu,
      nazev,
      typ,
      intervalMesicu: Number(intervalMesicu),
      cena: cena ? String(cena) : null,
      zacatek: new Date(zacatek),
      konec: konec ? new Date(konec) : null,
      autoRenewal: autoRenewal ?? false,
      poznamka: poznamka ?? null,
    },
  })

  // Auto-generate visits
  const navstevyData = generateNavstevy(
    kontrakt.id,
    orgId,
    kontrakt.zacatek,
    kontrakt.konec,
    kontrakt.intervalMesicu,
  )

  if (navstevyData.length > 0) {
    await prisma.servisniNavsteva.createMany({ data: navstevyData })
  }

  return NextResponse.json(kontrakt, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const kontrakty = await prisma.servisniKontrakt.findMany({
    where: { orgId },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
      servisniNavstevy: {
        where: { stav: 'PLANOVANA' },
        orderBy: { planovanyTermin: 'asc' },
        take: 1,
      },
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(kontrakty)
}
