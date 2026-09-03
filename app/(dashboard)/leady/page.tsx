import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { listUsersWithPerm } from '@/lib/zakazkyHelpers'
import { prisma } from '@/lib/prisma'
import { notFound, redirect } from 'next/navigation'
import LeadyPageClient from './LeadyPageClient'

export default async function LeadyPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const plan = (session.user as { plan?: string }).plan
  if (plan === 'STARTER') redirect('/dashboard')

  const orgId = session.user.orgId
  const perms = getPerms(session.user)

  const [leady, users] = await Promise.all([
    prisma.lead.findMany({
      where: { orgId },
      include: {
        assignedTo: { select: { id: true, jmeno: true } },
        _count: { select: { notes: true } },
      },
      orderBy: { vytvoreno: 'desc' },
    }),
    listUsersWithPerm(orgId, 'obchod'),
  ])

  const novychCount = leady.filter(l => l.status === 'NOVY').length

  return (
    <LeadyPageClient
      leady={leady.map(l => ({
        ...l,
        odhadovanaHodnota: l.odhadovanaHodnota ? Number(l.odhadovanaHodnota) : null,
        vytvoreno: l.vytvoreno.toISOString(),
        updatedAt: l.updatedAt.toISOString(),
      }))}
      users={users}
      novychCount={novychCount}
      currentUserId={session.user.id}
      canEdit={perms.obchod}
      canDelete={perms.obchodMazani}
    />
  )
}
