import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { isEmailConfigured, sendEmail, emailActivityReminder } from '../lib/email'

/**
 * Připomínky aktivit: sweep najde zralé aktivity, processReminder každou
 * atomicky "claimne" (reminderSentAt) — duplikáty nehrozí ani při souběhu.
 * Email je best-effort: po claimu se chyba jen zaloguje, bell notifikace
 * v aplikaci je primární kanál.
 */

export async function findDueReminders(prisma: PrismaClient) {
  return prisma.activity.findMany({
    where: { reminderAt: { lte: new Date() }, reminderSentAt: null, stav: 'PLANOVANA' },
    select: { id: true },
    orderBy: { reminderAt: 'asc' },
    take: 200,
  })
}

export type ReminderResult = 'sent' | 'bell-only' | 'email-failed' | 'skipped'

export async function processReminder(prisma: PrismaClient, activityId: string): Promise<ReminderResult> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
    include: {
      deal: { select: { id: true, orgId: true, kod: true, predmet: true, organization: { select: { slug: true } } } },
      resitel: { select: { id: true, jmeno: true, email: true, aktivni: true } },
      user: { select: { id: true, jmeno: true, email: true, aktivni: true } },
    },
  })
  if (
    !activity?.reminderAt ||
    activity.reminderSentAt ||
    activity.stav !== 'PLANOVANA' ||
    activity.reminderAt > new Date()
  ) {
    return 'skipped'
  }

  const prijemce = activity.resitel ?? activity.user
  if (!prijemce) return 'skipped'

  const claim = await prisma.activity.updateMany({
    where: { id: activityId, reminderSentAt: null },
    data: { reminderSentAt: new Date() },
  })
  if (claim.count === 0) return 'skipped'

  const co = (activity.popis || activity.typ).slice(0, 80)
  const dealLabel = activity.deal.kod || activity.deal.predmet || 'obchodní případ'

  await createNotification({
    orgId: activity.deal.orgId,
    userId: prijemce.id,
    typ: 'PRIPOMINKA',
    zprava: `Připomínka: ${co} (${dealLabel})`,
    dealId: activity.deal.id,
  })

  if (!isEmailConfigured() || !prijemce.email || !prijemce.aktivni) return 'bell-only'

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${activity.deal.organization.slug}.${rootDomain}/deals/${activity.deal.id}`
  const termin =
    new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeZone: 'Europe/Prague' }).format(activity.datum) +
    (activity.cas ? ` v ${activity.cas}` : '')

  try {
    await sendEmail(prijemce.email, `Připomínka: ${co}`, emailActivityReminder(prijemce.jmeno, co, dealLabel, termin, url))
  } catch (err) {
    console.error(`[reminders] email pro aktivitu ${activityId} selhal:`, err)
    return 'email-failed'
  }
  return 'sent'
}
