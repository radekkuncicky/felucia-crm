import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    zarizeniCount,
    aktivniKontrakty,
    nadchazejiNavstevy,
    presleNavstevy,
    dokonceneNavstevy,
  ] = await Promise.all([
    prisma.zarizeni.count({ where: { orgId, aktivni: true } }),
    prisma.servisniKontrakt.count({ where: { orgId, aktivni: true } }),
    prisma.servisniNavsteva.count({
      where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lte: thirtyDaysFromNow, gte: now } },
    }),
    prisma.servisniNavsteva.count({
      where: { orgId, stav: 'PLANOVANA', planovanyTermin: { lt: now } },
    }),
    prisma.servisniNavsteva.count({
      where: { orgId, stav: 'DOKONCENA' },
    }),
  ])

  return NextResponse.json({
    zarizeniCount,
    aktivniKontrakty,
    nadchazejiNavstevy,
    presleNavstevy,
    dokonceneNavstevy,
  })
}
