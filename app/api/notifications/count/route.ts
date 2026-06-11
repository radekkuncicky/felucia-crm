import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { getOrgSettings } from '@/lib/orgSettings'
import { getPlanLimits } from '@/lib/planLimits'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions) ?? await getMobileSession(req)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, id: userId, role } = session.user
  const db = orgPrisma(orgId)

  const orgSettings = await getOrgSettings(orgId)
  const dniBezeAktivity = orgSettings.notifDniBezeAktivity ?? 7

  const sevenDaysAgo = new Date(Date.now() - dniBezeAktivity * 24 * 60 * 60 * 1000)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const isPlatinum = getPlanLimits(session.user.plan).hasServiceModule

  const now = new Date()

  const [activeDeals, nesplneneUkoly, noveOP, bliziciSeServisy, kritickeServisy, servisyPoTerminu, unreadNotifications] = await Promise.all([
    db.deal.findMany({
      where: { orgId, userId, stav: { notIn: ['USPECH', 'PAS'] } },
      select: { activities: { orderBy: { datum: 'desc' }, take: 1, select: { datum: true } } },
    }),
    db.activity.count({
      where: { typ: 'UKOL', splneno: false, deal: { orgId, userId } },
    }),
    db.deal.count({
      where: role === 'ADMIN'
        ? { orgId, vytvoreno: { gte: oneDayAgo } }
        : { orgId, userId, vytvoreno: { gte: oneDayAgo } },
    }),
    isPlatinum
      ? db.servisniNavsteva.count({
          where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lte: thirtyDaysFromNow } },
        })
      : Promise.resolve(0),
    isPlatinum
      ? db.servisniNavsteva.count({
          where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lte: sevenDaysFromNow } },
        })
      : Promise.resolve(0),
    isPlatinum
      ? db.servisniNavsteva.count({
          where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lt: now } },
        })
      : Promise.resolve(0),
    db.notification.count({ where: { userId, precteno: false } }),
  ])

  const opBezAktivityCount = orgSettings.notifOpBezAktivity
    ? activeDeals.filter(d =>
        d.activities.length === 0 || new Date(d.activities[0].datum) < sevenDaysAgo
      ).length
    : 0

  return NextResponse.json({
    opBezAktivity: opBezAktivityCount,
    nesplneneUkoly,
    noveOP: orgSettings.notifNovyOP ? noveOP : 0,
    bliziciSeServisy: orgSettings.notifBlizkTermin ? bliziciSeServisy : 0,
    kritickeServisy: orgSettings.notifBlizkTermin ? kritickeServisy : 0,
    servisyPoTerminu: isPlatinum ? servisyPoTerminu : 0,
    unreadNotifications,
  })
}
