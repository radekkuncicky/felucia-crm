import { prisma } from '@/lib/prisma'
import { listUsersWithPerm } from '@/lib/zakazkyHelpers'

export async function notifyNewLead(orgId: string, leadId: string, jmeno: string) {
  const settings = await prisma.orgSettings.findUnique({ where: { orgId } })
  if (!settings?.notifNovyLead) return

  const users = await listUsersWithPerm(orgId, 'obchod')

  await prisma.notification.createMany({
    data: users.map(u => ({
      orgId,
      userId: u.id,
      typ: 'NOVY_LEAD',
      zprava: `Nový lead z webu: ${jmeno}`,
      url: `/leady/${leadId}`,
    })),
  })
}
