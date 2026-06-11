import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import SystemClient from './SystemClient'

export default async function SystemPage() {
  const session = await getServerSession(authOptions)
  if (!session?.user?.isSuperAdmin) redirect('/dashboard')

  let settings = await prisma.systemSettings.findFirst()
  if (!settings) {
    settings = await prisma.systemSettings.create({ data: {} })
  }

  return (
    <SystemClient
      settings={{
        id: settings.id,
        maintenanceMode: settings.maintenanceMode,
        maintenanceMessage: settings.maintenanceMessage,
        announcementText: settings.announcementText ?? '',
        announcementActive: settings.announcementActive,
        announcementColor: settings.announcementColor,
      }}
    />
  )
}
