import { getPlanLimits } from '@/lib/planLimits'
import { forbidden, getPerms } from '@/lib/permissions'
import { isOwned, isOwnedOrEmpty } from '@/lib/ownership'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import type { Prisma } from '@prisma/client'
import { NextResponse } from 'next/server'
import { nextServisniKontraktCislo } from '@/lib/servisniKontraktCislo'

// Horizont dopředného generování zakázek z kontraktu. Dál se dogeneruje postupně
// (zabrání zahlcení seznamu u kontraktu bez konce / s krátkým intervalem).
const GENEROVAT_MESICU = 24

function generateNavstevy(kontraktId: string, orgId: string, zacatek: Date, konec: Date | null, intervalMesicu: number) {
  const dates: Date[] = []
  const current = new Date(zacatek)
  const horizont = new Date(zacatek.getFullYear(), zacatek.getMonth() + GENEROVAT_MESICU, zacatek.getDate())
  const end = konec && konec < horizont ? konec : horizont

  while (current < end) {
    dates.push(new Date(current))
    current.setMonth(current.getMonth() + intervalMesicu)
  }

  return dates.map(d => ({
    orgId,
    kontraktId,
    planovanyTermin: d,
    stav: 'NAPLANOVANA' as const,
  }))
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).servisDispecink) return forbidden()
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const body = await req.json()
  const { dealId, zarizeniId, klientId, nazev, typ, intervalMesicu, cena, zacatek, konec, poznamka, autoRenewal } = body

  if (!klientId || !nazev || !typ || !intervalMesicu || !zacatek) {
    return NextResponse.json({ error: 'Chybí povinné pole' }, { status: 400 })
  }

  // FK z těla requestu musí patřit téže org (RLS FK kontroly neobsahuje)
  const db = orgPrisma(orgId)
  if (!(await isOwned(db, 'client', klientId))) return NextResponse.json({ error: 'Klient nenalezen' }, { status: 404 })
  if (!(await isOwnedOrEmpty(db, 'deal', dealId))) return NextResponse.json({ error: 'OP nenalezen' }, { status: 404 })
  if (!(await isOwnedOrEmpty(db, 'zarizeni', zarizeniId))) return NextResponse.json({ error: 'Zařízení nenalezeno' }, { status: 404 })

  // Číslo kontraktu i čísla vygenerovaných zakázek v jedné transakci pod
  // advisory zámky (bezpečné při souběhu, na rozdíl od dřívějšího COUNT+1).
  // Transakce jde přes orgPrisma → RLS jako druhá vrstva i tady.
  const kontrakt = await db.$transaction(async (tx) => {
    // orgPrisma tx je strukturálně stejný klient, jen s jiným TS typem (extension)
    const cisloKontraktu = await nextServisniKontraktCislo(tx as unknown as Prisma.TransactionClient, orgId)
    const k = await tx.servisniKontrakt.create({
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

    const navstevyData = generateNavstevy(k.id, orgId, k.zacatek, k.konec, k.intervalMesicu)
    if (navstevyData.length > 0) {
      const yy = new Date().getFullYear().toString().slice(2)
      const prefix = `SZ-${yy}-`
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`szc:${orgId}:${yy}`}))`
      const last = await tx.servisniZakazka.findFirst({
        where: { orgId, cislo: { startsWith: prefix } },
        orderBy: { cislo: 'desc' },
        select: { cislo: true },
      })
      let n = last?.cislo ? parseInt(last.cislo.slice(prefix.length), 10) : 0
      const data = navstevyData.map((v) => ({ ...v, cislo: `${prefix}${String(++n).padStart(4, '0')}` }))
      await tx.servisniZakazka.createMany({ data })
    }

    return k
  })

  return NextResponse.json(kontrakt, { status: 201 })
}

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const kontrakty = await db.servisniKontrakt.findMany({
    where: { orgId },
    include: {
      klient: { select: { id: true, jmeno: true, prijmeni: true } },
      deal: { select: { id: true, kod: true, predmet: true } },
      servisniZakazky: {
        where: { stav: 'NAPLANOVANA' },
        orderBy: { planovanyTermin: 'asc' },
        take: 1,
      },
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(kontrakty)
}
