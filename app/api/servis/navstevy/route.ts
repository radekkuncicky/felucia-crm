import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const stav = searchParams.get('stav')

  const navstevy = await prisma.servisniNavsteva.findMany({
    where: {
      orgId,
      ...(from || to ? {
        planovanyTermin: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to ? { lte: new Date(to) } : {}),
        },
      } : {}),
      ...(stav ? { stav: stav as 'PLANOVANA' | 'POTVRZENA' | 'PROBIHA' | 'DOKONCENA' | 'ZRUSENA' | 'PRESLA' } : {}),
    },
    include: {
      kontrakt: {
        select: {
          id: true,
          nazev: true,
          klient: { select: { id: true, jmeno: true, prijmeni: true } },
        },
      },
      zarizeni: { select: { id: true, nazev: true, typ: true } },
      technik: { select: { id: true, jmeno: true } },
    },
    orderBy: { planovanyTermin: 'asc' },
  })

  return NextResponse.json(navstevy)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const { planovanyTermin, technikId, poznamka, typ, zarizeniId, klientId, kontraktId } = body

  if (!planovanyTermin) return NextResponse.json({ error: 'planovanyTermin required' }, { status: 400 })

  // SECURITY FIX: Validate that the provided date is actually parseable
  const parsedTermin = new Date(planovanyTermin)
  if (isNaN(parsedTermin.getTime())) {
    return NextResponse.json({ error: 'Neplatný formát data planovanyTermin' }, { status: 400 })
  }

  // SECURITY FIX: Verify all referenced IDs belong to this org to prevent cross-tenant IDOR
  if (zarizeniId) {
    const zarizeni = await prisma.zarizeni.findFirst({ where: { id: zarizeniId, orgId } })
    if (!zarizeni) return NextResponse.json({ error: 'Zařízení nebylo nalezeno' }, { status: 400 })
  }
  if (klientId) {
    const klient = await prisma.client.findFirst({ where: { id: klientId, orgId } })
    if (!klient) return NextResponse.json({ error: 'Klient nebyl nalezen' }, { status: 400 })
  }
  if (kontraktId) {
    const kontrakt = await prisma.servisniKontrakt.findFirst({ where: { id: kontraktId, orgId } })
    if (!kontrakt) return NextResponse.json({ error: 'Kontrakt nebyl nalezen' }, { status: 400 })
  }
  if (technikId) {
    const technik = await prisma.user.findFirst({ where: { id: technikId, orgId } })
    if (!technik) return NextResponse.json({ error: 'Technik nebyl nalezen v této organizaci' }, { status: 400 })
  }

  const year = new Date().getFullYear().toString().slice(2)
  const count = await prisma.servisniNavsteva.count({ where: { orgId } })
  const cisloNavstevy = `SN-${year}-${String(count + 1).padStart(3, '0')}`

  const navsteva = await prisma.servisniNavsteva.create({
    data: {
      orgId,
      cisloNavstevy,
      typ: typ || 'PLANOVANY_SERVIS',
      planovanyTermin: parsedTermin,
      technikId: technikId || null,
      poznamka: poznamka || null,
      kontraktId: kontraktId || null,
      zarizeniId: zarizeniId || null,
      klientId: klientId || null,
    },
  })

  return NextResponse.json(navsteva, { status: 201 })
}
