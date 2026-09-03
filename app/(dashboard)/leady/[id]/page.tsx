import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { listUsersWithPerm } from '@/lib/zakazkyHelpers'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import LeadDetailClient from './LeadDetailClient'

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const perms = getPerms(session.user)
  const plan = (session.user as { plan?: string }).plan
  if (plan === 'STARTER') notFound()

  const lead = await prisma.lead.findFirst({
    where: { id: params.id, orgId },
    include: {
      assignedTo: { select: { id: true, jmeno: true, email: true, avatar: true } },
      notes: {
        include: { user: { select: { id: true, jmeno: true, avatar: true } } },
        orderBy: { vytvoreno: 'asc' },
      },
      prevedenNaOp: {
        select: {
          id: true,
          kod: true,
          predmet: true,
          stav: true,
          vytvoreno: true,
          client: { select: { id: true, jmeno: true, prijmeni: true } },
        },
      },
    },
  })

  if (!lead) notFound()

  const users = await listUsersWithPerm(orgId, 'obchod')

  return (
    <LeadDetailClient
      lead={{
        ...lead,
        odhadovanaHodnota: lead.odhadovanaHodnota ? Number(lead.odhadovanaHodnota) : null,
        vytvoreno: lead.vytvoreno.toISOString(),
        updatedAt: lead.updatedAt.toISOString(),
        notes: lead.notes.map(n => ({
          ...n,
          vytvoreno: n.vytvoreno.toISOString(),
        })),
        prevedenNaOp: lead.prevedenNaOp
          ? {
              ...lead.prevedenNaOp,
              vytvoreno: lead.prevedenNaOp.vytvoreno.toISOString(),
            }
          : null,
      }}
      users={users}
      canEdit={perms.obchod}
      canDelete={perms.obchodMazani}
    />
  )
}
