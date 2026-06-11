import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import UsersClient from './UsersClient'

export default async function SuperAdminUsersPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  const users = await prisma.user.findMany({
    orderBy: [{ lastLoginAt: 'desc' }, { vytvoreno: 'desc' }],
    include: { organization: { select: { nazev: true, plan: true } } },
  })

  const orgs = await prisma.organization.findMany({
    orderBy: { nazev: 'asc' },
    select: { id: true, nazev: true },
  })

  return (
    <UsersClient
      users={users.map(u => ({
        id: u.id,
        jmeno: u.jmeno,
        email: u.email,
        role: u.role,
        aktivni: u.aktivni,
        isSuperAdmin: u.isSuperAdmin,
        vytvoreno: u.vytvoreno.toISOString(),
        lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        orgId: u.orgId,
        orgNazev: u.organization.nazev,
        orgPlan: u.organization.plan,
      }))}
      orgs={orgs}
    />
  )
}
