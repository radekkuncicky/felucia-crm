import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SuperAdminDashboard from './SuperAdminDashboard'

export default async function SuperAdminPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  const PLAN_PRICES: Record<string, number> = {
    STARTER: 49,
    STANDARD: 999,
    PROFESSIONAL: 1499,
    ENTERPRISE: 0,
  }

  const [
    totalOrgs,
    activeOrgs,
    totalUsers,
    planDistribution,
    recentOrgs,
  ] = await Promise.all([
    prisma.organization.count(),
    prisma.organization.count({ where: { aktivni: true } }),
    prisma.user.count(),
    prisma.organization.groupBy({ by: ['plan'], _count: { _all: true } }),
    prisma.organization.findMany({
      orderBy: { vytvoreno: 'desc' },
      take: 10,
      select: { id: true, nazev: true, plan: true, aktivni: true, vytvoreno: true, email: true },
    }),
  ])

  const mrr = planDistribution.reduce((sum, g) => {
    return sum + g._count._all * (PLAN_PRICES[g.plan] ?? 0)
  }, 0)

  return (
    <SuperAdminDashboard
      stats={{ totalOrgs, activeOrgs, totalUsers, mrr }}
      planDistribution={planDistribution.map(g => ({ plan: g.plan, count: g._count._all }))}
      recentOrgs={recentOrgs.map(o => ({
        ...o,
        vytvoreno: o.vytvoreno.toISOString(),
      }))}
    />
  )
}
