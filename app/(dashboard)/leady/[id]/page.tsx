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
      activities: {
        include: { user: { select: { jmeno: true } }, resitel: { select: { jmeno: true } } },
        orderBy: { datum: 'desc' },
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
        activities: lead.activities.map(a => ({
          id: a.id,
          typ: a.typ,
          popis: a.popis,
          vysledek: a.vysledek,
          datum: a.datum.toISOString().split('T')[0],
          cas: a.cas,
          stav: a.stav,
          userJmeno: a.user?.jmeno ?? null,
          resitelId: a.resitelId,
          resitelJmeno: a.resitel?.jmeno ?? null,
          reminderAt: a.reminderAt?.toISOString() ?? null,
        })),
        prevedenNaOp: lead.prevedenNaOp
          ? {
              ...lead.prevedenNaOp,
              vytvoreno: lead.prevedenNaOp.vytvoreno.toISOString(),
            }
          : null,
      }}
      users={users}
      currentUserId={session.user.id}
      canEdit={perms.obchod}
      canDelete={perms.obchodMazani}
    />
  )
}
