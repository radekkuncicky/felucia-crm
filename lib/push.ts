import { prisma } from '@/lib/prisma'

/**
 * Expo push notifikace. Token registruje mobilní appka přes
 * POST /api/mobile/push-token (User.pushToken). Payload `data` musí odpovídat
 * typu NotificationData v appce (felucia-tech/lib/notifications.ts).
 *
 * Volá se fire-and-forget z API routes — nikdy nevyhazuje, jen loguje.
 * Mrtvé tokeny (DeviceNotRegistered) se z DB mažou.
 */

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send'
const TIMEOUT_MS = 5000

export type PushMessage = {
  title: string
  body: string
  data?: { type: 'zakazka'; zakazkaId: string }
}

function isExpoPushToken(token: string) {
  return token.startsWith('ExponentPushToken[') || token.startsWith('ExpoPushToken[')
}

export async function sendPushToUsers(orgId: string, userIds: string[], message: PushMessage): Promise<void> {
  if (userIds.length === 0) return

  try {
    const users = await prisma.user.findMany({
      where: { id: { in: userIds }, orgId, pushToken: { not: null } },
      select: { id: true, pushToken: true },
    })
    const targets = users.filter((u): u is { id: string; pushToken: string } =>
      !!u.pushToken && isExpoPushToken(u.pushToken)
    )
    if (targets.length === 0) return

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
    let tickets: { status: string; details?: { error?: string } }[]
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(targets.map(t => ({
          to: t.pushToken,
          title: message.title,
          body: message.body,
          data: message.data,
          sound: 'default',
        }))),
        signal: controller.signal,
      })
      if (!res.ok) {
        console.error(`[push] Expo API ${res.status}: ${await res.text()}`)
        return
      }
      tickets = (await res.json()).data ?? []
    } finally {
      clearTimeout(timer)
    }

    // tickets jsou ve stejném pořadí jako odeslané zprávy
    const deadUserIds = targets
      .filter((_, i) => tickets[i]?.status === 'error' && tickets[i]?.details?.error === 'DeviceNotRegistered')
      .map(t => t.id)
    if (deadUserIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: deadUserIds } },
        data: { pushToken: null },
      })
      console.log(`[push] smazány mrtvé tokeny: ${deadUserIds.length}`)
    }

    const failed = tickets.filter(t => t.status === 'error' && t.details?.error !== 'DeviceNotRegistered')
    if (failed.length > 0) console.error('[push] chyby ticketů:', JSON.stringify(failed))
  } catch (err) {
    console.error('[push] odeslání selhalo:', err)
  }
}
