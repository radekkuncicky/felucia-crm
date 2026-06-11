import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zarizeni = await prisma.zarizeni.findMany({
    where: { orgId },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
      servisniKontrakty: {
        where: { aktivni: true },
        select: { id: true, nazev: true, typ: true, konec: true },
      },
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(zarizeni)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const { klientId, dealId, nazev, typ, vyrobniCislo, datumInstalace, zarukaDo, poznamka } = body

  if (!klientId || !nazev) {
    return NextResponse.json({ error: 'Chybí povinné pole' }, { status: 400 })
  }

  // Generate QR token
  const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET ?? '')
  const tempId = `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const qrToken = await new SignJWT({ zarizeniId: tempId, orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10y')
    .sign(secret)

  const zarizeni = await prisma.zarizeni.create({
    data: {
      orgId,
      klientId,
      dealId: dealId || null,
      nazev,
      typ: typ || 'JINE',
      vyrobniCislo: vyrobniCislo || null,
      datumInstalace: datumInstalace ? new Date(datumInstalace) : null,
      zarukaDo: zarukaDo ? new Date(zarukaDo) : null,
      poznamka: poznamka || null,
      qrToken,
    },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
    },
  })

  // Update token with real ID
  const finalToken = await new SignJWT({ zarizeniId: zarizeni.id, orgId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('10y')
    .sign(secret)
  const finalZarizeni = await prisma.zarizeni.update({
    where: { id: zarizeni.id },
    data: { qrToken: finalToken },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
    },
  })

  return NextResponse.json(finalZarizeni, { status: 201 })
}
