import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'
import { SignJWT } from 'jose'
import { prisma } from '@/lib/prisma'
import { nextServisniZakazkaCislo } from '@/lib/servisniZakazkaCislo'
import { nextServisniKontraktCislo } from '@/lib/servisniKontraktCislo'
import { getPerms, forbidden } from '@/lib/permissions'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).zakazkyEdit) return forbidden()

  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) {
    return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })
  }

  const zakazka = await db.zakazka.findFirst({
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

    const zarizeni = await db.zarizeni.create({
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
    await db.zarizeni.update({ where: { id: zarizeni.id }, data: { qrToken: finalToken } })

    finalZarizeniId = zarizeni.id
  }

  const intervalMesicu = typKontraktu === 'ROCNI' ? 12 : typKontraktu === 'POLOLETNI' ? 6 : typKontraktu === 'DVOULETNI' ? 24 : 0

  // Kontrakt + první zakázka v jedné transakci; čísla SK-YY-NNN a SZ-YY-NNNN
  // přes advisory zámky (jednotné s /api/servis/kontrakty, dřív tu byl vlastní
  // formát SK-0001 z parsování posledního čísla).
  const { kontrakt, navsteva } = await prisma.$transaction(async (tx) => {
    const cisloKontraktu = await nextServisniKontraktCislo(tx, orgId)
    const k = await tx.servisniKontrakt.create({
      data: {
        orgId,
        zarizeniId: finalZarizeniId,
        klientId: zakazka.klientId,
        cisloKontraktu,
        nazev: `Servis - ${zakazka.nazev}`,
        typ: typKontraktu ?? 'JEDNOURAZOVY',
        intervalMesicu,
        zacatek: new Date(),
        aktivni: true,
      },
    })

    const cislo = await nextServisniZakazkaCislo(tx, orgId)
    const n = await tx.servisniZakazka.create({
      data: {
        orgId,
        kontraktId: k.id,
        zarizeniId: finalZarizeniId,
        klientId: zakazka.klientId,
        cislo,
        typ: 'PLANOVANY_SERVIS',
        planovanyTermin: new Date(pristiServis),
        stav: 'NAPLANOVANA',
      },
    })

    return { kontrakt: k, navsteva: n }
  })

  return NextResponse.json({
    ok: true,
    zarizeniId: finalZarizeniId,
    kontraktId: kontrakt.id,
    navstevaId: navsteva.id,
  }, { status: 201 })
}
