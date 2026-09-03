import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import AuditLogTable from './AuditLogTable'
import { getPerms } from '@/lib/permissions'

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { page?: string; user?: string; akce?: string; zaznam?: string }
}) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).analytiky) redirect('/dashboard')
  const orgId = session.user.orgId

  const page = Math.max(1, Number(searchParams.page ?? 1))
  const PAGE_SIZE = 20

  const where: Record<string, unknown> = { orgId }
  if (searchParams.user) where.userId = searchParams.user
  if (searchParams.akce) where.typAkce = searchParams.akce
  if (searchParams.zaznam) where.typZaznamu = searchParams.zaznam

  const [logs, total, users] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, jmeno: true } } },
      orderBy: { vytvoreno: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where }),
    prisma.user.findMany({ where: { orgId }, select: { id: true, jmeno: true } }),
  ])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Historie změn</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Audit log všech změn v systému</p>
        </div>
        <a
          href="/api/settings/audit-log/export"
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 hover:border-gray-400 px-3 py-2 rounded-lg transition-colors"
        >
          ↓ Export CSV
        </a>
      </div>
      <AuditLogTable
        logs={logs.map(l => ({
          id: l.id,
          typAkce: l.typAkce,
          typZaznamu: l.typZaznamu,
          zaznamId: l.zaznamId,
          zaznamNazev: l.zaznamNazev,
          userJmeno: l.user?.jmeno ?? 'Systém',
          vytvoreno: l.vytvoreno.toISOString(),
        }))}
        total={total}
        page={page}
        pageSize={PAGE_SIZE}
        users={users}
      />
    </div>
  )
}
