import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import LogsClient from './LogsClient'

export default async function LogsPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  const logs = await prisma.auditLog.findMany({
    orderBy: { vytvoreno: 'desc' },
    take: 200,
    include: {
      organization: { select: { nazev: true } },
      user: { select: { jmeno: true, email: true } },
    },
  })

  return (
    <LogsClient
      logs={logs.map(l => ({
        id: l.id,
        orgId: l.orgId,
        orgNazev: l.organization.nazev,
        userId: l.userId,
        userJmeno: l.user?.jmeno ?? null,
        userEmail: l.user?.email ?? null,
        typAkce: l.typAkce,
        typZaznamu: l.typZaznamu,
        zaznamId: l.zaznamId,
        zaznamNazev: l.zaznamNazev,
        zmeny: l.zmeny,
        vytvoreno: l.vytvoreno.toISOString(),
      }))}
    />
  )
}
