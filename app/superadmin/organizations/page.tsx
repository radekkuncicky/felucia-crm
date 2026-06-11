import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import OrganizationsClient from './OrganizationsClient'

export default async function OrganizationsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  const orgs = await prisma.organization.findMany({
    orderBy: { vytvoreno: 'desc' },
    include: {
      _count: { select: { users: true, deals: true, clients: true } },
      orgSettings: { select: { modulServis: true, modulAnalytiky: true, modulDokumenty: true, modulDasa: true } },
    },
  })

  return (
    <OrganizationsClient
      organizations={orgs.map(o => ({
        id: o.id,
        nazev: o.nazev,
        slug: o.slug,
        email: o.email,
        plan: o.plan,
        aktivni: o.aktivni,
        vytvoreno: o.vytvoreno.toISOString(),
        planActiveTo: o.planActiveTo?.toISOString() ?? null,
        stripeCustomerId: o.stripeCustomerId,
        _count: o._count,
        orgSettings: o.orgSettings,
      }))}
    />
  )
}
