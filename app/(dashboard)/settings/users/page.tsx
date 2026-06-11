import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import UsersManager from './UsersManager'
import { getPlanLimits } from '@/lib/planLimits'

export default async function UsersPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  if (session.user.role !== 'ADMIN') redirect('/dashboard')

  const orgId = session.user.orgId

  const [users, org] = await Promise.all([
    prisma.user.findMany({
      where: { orgId },
      select: { id: true, jmeno: true, email: true, role: true, aktivni: true, vytvoreno: true, serviceAccess: true },
      orderBy: { vytvoreno: 'asc' },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
  ])

  const planLimits = getPlanLimits(org?.plan ?? 'STARTER')
  const activeUserCount = users.filter(u => u.aktivni).length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Správa uživatelů</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Přidávejte a spravujte uživatele vaší organizace.</p>
      </div>
      <UsersManager
        users={users.map(u => ({ ...u, vytvoreno: u.vytvoreno.toISOString() }))}
        maxUsers={planLimits.maxUsers}
        activeUserCount={activeUserCount}
      />
    </div>
  )
}
