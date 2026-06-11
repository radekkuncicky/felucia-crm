import { prisma } from './prisma'

export async function createNotification(params: {
  orgId: string
  userId: string
  typ: string
  zprava: string
  dealId?: string
  klientId?: string
  url?: string
}) {
  try {
    await prisma.notification.create({ data: params })
  } catch {
    // notifikace nikdy nesmí shodit hlavní akci
  }
}
