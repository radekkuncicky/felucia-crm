import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { SignJWT } from 'jose'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role === 'TECHNIK') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) {
    return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })
  }

  const zakazka = await prisma.zakazka.findFirst({
    where: { id: params.id, orgId, stav: 'HOTOVO' },
  })
  if (!zakazka) return NextResponse.json({ error: 'Zakázka nenalezena nebo není ve stavu HOTOVO' }, { status: 404 })

  const body = await req.json()
  const {
    zarizeniId,      // null if creating new
    nazevZarizeni,
    typZarizeni,
    typKontraktu,
    pristiServis,
    poznamka,
  } = body

  if (!pristiServis) {
    return NextResponse.json({ error: 'Datum příštího servisu je povinné' }, { status: 400 })
  }

  let finalZarizeniId = zarizeniId

  // Create new Zarizeni if not selected
  if (!finalZarizeniId) {
    if (!nazevZarizeni) {
      return NextResponse.json({ error: 'Název zařízení je povinný' }, { status: 400 })
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
        klientId: zakazka.klientId,
        dealId: zakazka.opId ?? null,
        nazev: nazevZarizeni,
        typ: typZarizeni ?? 'JINE',
        poznamka: poznamka ?? null,
        qrToken,
      },
    })

    // Update with real ID token
    const finalToken = await new SignJWT({ zarizeniId: zarizeni.id, orgId })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('10y')
      .sign(secret)
    await prisma.zarizeni.update({ where: { id: zarizeni.id }, data: { qrToken: finalToken } })

    finalZarizeniId = zarizeni.id
  }

  // Get last kontrakt number
  const lastKontrakt = await prisma.servisniKontrakt.findFirst({
    where: { zarizeni: { orgId } },
    orderBy: { vytvoreno: 'desc' },
    select: { cisloKontraktu: true },
  })
  const cisloNum = lastKontrakt?.cisloKontraktu
    ? parseInt(lastKontrakt.cisloKontraktu.replace(/\D/g, ''), 10) + 1
    : 1
  const cisloKontraktu = `SK-${String(cisloNum).padStart(4, '0')}`

  const intervalMesicu = typKontraktu === 'ROCNI' ? 12 : typKontraktu === 'POLOLETNI' ? 6 : typKontraktu === 'DVOULETNI' ? 24 : 0

  // Create ServisniKontrakt
  const kontrakt = await prisma.servisniKontrakt.create({
    data: {
      orgId,
      zarizeniId: finalZarizeniId,
      klientId: zakazka.klientId,
      cisloKontraktu,
      nazev: `Servis — ${zakazka.nazev}`,
      typ: typKontraktu ?? 'JEDNOURAZOVY',
      intervalMesicu,
      zacatek: new Date(),
      aktivni: true,
    },
  })

  // Get next visit number
  const navstevaCount = await prisma.servisniNavsteva.count({ where: { kontrakt: { zarizeni: { orgId } } } })
  const cisloNavstevy = `SN-${String(navstevaCount + 1).padStart(4, '0')}`

  // Create first planned visit
  const navsteva = await prisma.servisniNavsteva.create({
    data: {
      orgId,
      kontraktId: kontrakt.id,
      zarizeniId: finalZarizeniId,
      klientId: zakazka.klientId,
      cisloNavstevy,
      typ: 'PLANOVANY_SERVIS',
      planovanyTermin: new Date(pristiServis),
      stav: 'PLANOVANA',
    },
  })

  return NextResponse.json({
    ok: true,
    zarizeniId: finalZarizeniId,
    kontraktId: kontrakt.id,
    navstevaId: navsteva.id,
  }, { status: 201 })
}
