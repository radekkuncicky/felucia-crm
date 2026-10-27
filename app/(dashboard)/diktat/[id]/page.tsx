import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { orgPrisma } from '@/lib/orgPrisma'
import { activityParent } from '@/lib/activities'
import { notFound, redirect } from 'next/navigation'
import { getOrgSettings } from '@/lib/orgSettings'
import DiktatDetailClient from './DiktatDetailClient'

export default async function DiktatPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).obchod) notFound()
  const orgId = session.user.orgId

  const a = await orgPrisma(orgId).activity.findFirst({
    where: { id: params.id, orgId },
    select: {
      id: true, popis: true, datum: true, stav: true, vytvoreno: true,
      user: { select: { jmeno: true } },
      deal: { select: { id: true } },
      lead: { select: { id: true, jmeno: true } },
    },
  })
  if (!a) notFound()
  // Už zpracovaný diktát → je to hovor v historii leadu / OP
  const parent = activityParent(a)
  if (parent && parent.druh !== 'DIKTAT') redirect(parent.href)

  return (
    <DiktatDetailClient
      diktat={{
        id: a.id,
        text: a.popis ?? '',
        datum: a.datum.toISOString().slice(0, 10),
        hotovo: a.stav === 'DOKONCENA',
        vytvoreno: a.vytvoreno.toISOString(),
        autor: a.user?.jmeno ?? null,
      }}
      maDasu={getPlanLimits(session.user.plan ?? 'STARTER').canUseAI && (await getOrgSettings(orgId)).modulDasa}
    />
  )
}
