import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getPlanLimits } from '@/lib/planLimits'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, id: userId, role } = session.user
  const db = orgPrisma(orgId)

  const orgSettings = await import('@/lib/orgSettings').then(m => m.getOrgSettings(orgId))
  const dniBezeAktivity = orgSettings.notifDniBezeAktivity ?? 7

  const sevenDaysAgo = new Date(Date.now() - dniBezeAktivity * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  const now = Date.now()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const isPlatinum = getPlanLimits(session.user.plan).hasServiceModule

  // A) Active deals without activity in 7+ days
  const activeDeals = await db.deal.findMany({
    where: { orgId, userId, stav: { notIn: ['USPECH', 'PAS'] } },
    include: {
      client: { select: { jmeno: true, prijmeni: true } },
      activities: { orderBy: { datum: 'desc' }, take: 1, select: { datum: true } },
    },
  })

  const opBezAktivity = activeDeals
    .filter(d => d.activities.length === 0 || new Date(d.activities[0].datum) < sevenDaysAgo)
    .map(d => {
      const lastActivity = d.activities[0]?.datum
      const dniBezAktivity = lastActivity
        ? Math.floor((now - new Date(lastActivity).getTime()) / 86400000)
        : null
      return {
        id: d.id,
        kod: d.kod,
        klient: `${d.client.jmeno} ${d.client.prijmeni}`,
        dniBezAktivity,
      }
    })

  // B) Unsolved tasks
  const nesplneneUkoly = await db.activity.findMany({
    where: { typ: 'UKOL', splneno: false, deal: { orgId, userId } },
    include: { deal: { select: { id: true, kod: true, predmet: true } } },
    orderBy: { datum: 'asc' },
  })

  // D) Overdue planned activities (stav=PLANOVANA, datum < today)
  const prosleAktivityRaw = await db.activity.findMany({
    where: { stav: 'PLANOVANA', datum: { lt: today }, deal: { orgId, userId } },
    include: { deal: { select: { id: true, kod: true, predmet: true } } },
    orderBy: { datum: 'asc' },
    take: 20,
  })

  // C) New deals in last 24h
  const noveOPWhere = role === 'ADMIN'
    ? { orgId, vytvoreno: { gte: oneDayAgo } }
    : { orgId, userId, vytvoreno: { gte: oneDayAgo } }

  const [noveOP, bliziciSeServisy, servisyPoTerminu] = await Promise.all([
    db.deal.findMany({
      where: noveOPWhere,
      include: { client: { select: { jmeno: true, prijmeni: true } } },
      orderBy: { vytvoreno: 'desc' },
    }),
    isPlatinum
      ? db.servisniNavsteva.findMany({
          where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lte: thirtyDaysFromNow, gte: new Date() } },
          include: {
            kontrakt: { include: { klient: { select: { jmeno: true, prijmeni: true } } } },
          },
          orderBy: { planovanyTermin: 'asc' },
          take: 10,
        })
      : Promise.resolve([]),
    isPlatinum
      ? db.servisniNavsteva.findMany({
          where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lt: new Date() } },
          include: {
            kontrakt: { include: { klient: { select: { jmeno: true, prijmeni: true } } } },
            zarizeni: { select: { nazev: true } },
          },
          orderBy: { planovanyTermin: 'asc' },
          take: 10,
        })
      : Promise.resolve([]),
  ])

  return NextResponse.json({
    opBezAktivity,
    prosleAktivity: prosleAktivityRaw.map(a => ({
      id: a.id,
      typ: a.typ,
      popis: a.popis,
      datum: a.datum.toISOString(),
      dealId: a.deal.id,
      dealKod: a.deal.kod,
      dealPredmet: a.deal.predmet,
    })),
    nesplneneUkoly: nesplneneUkoly.map(a => ({
      id: a.id,
      popis: a.popis,
      datum: a.datum.toISOString(),
      dealId: a.deal.id,
      dealKod: a.deal.kod,
      dealPredmet: a.deal.predmet,
    })),
    noveOP: noveOP.map(d => ({
      id: d.id,
      kod: d.kod,
      klient: `${d.client.jmeno} ${d.client.prijmeni}`,
      technologie: d.technologie,
      stav: d.stav,
      vytvoreno: d.vytvoreno.toISOString(),
    })),
    bliziciSeServisy: bliziciSeServisy.map(n => ({
      id: n.id,
      planovanyTermin: n.planovanyTermin.toISOString(),
      kontrakt: n.kontrakt ? {
        nazev: n.kontrakt.nazev,
        klient: { jmeno: n.kontrakt.klient.jmeno, prijmeni: n.kontrakt.klient.prijmeni },
      } : null,
    })),
    servisyPoTerminu: servisyPoTerminu.map(n => ({
      id: n.id,
      planovanyTermin: n.planovanyTermin.toISOString(),
      zarizeniNazev: (n as { zarizeni?: { nazev: string } | null }).zarizeni?.nazev ?? null,
      kontrakt: n.kontrakt ? {
        nazev: n.kontrakt.nazev,
        klient: { jmeno: n.kontrakt.klient.jmeno, prijmeni: n.kontrakt.klient.prijmeni },
      } : null,
    })),
  })
}
