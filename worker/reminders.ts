import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { isEmailConfigured, sendEmail, emailActivityReminder } from '../lib/email'
import { activityParent, TYP_LABEL } from '../lib/activities'

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
      organization: { select: { slug: true } },
      deal: { select: { id: true, kod: true, predmet: true, client: { select: { jmeno: true, prijmeni: true } } } },
      lead: { select: { id: true, jmeno: true, firma: true } },
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

  const parent = activityParent(activity)
  const typLabel = TYP_LABEL[activity.typ] ?? activity.typ
  const popis = activity.popis ? activity.popis.slice(0, 200) : null
  // „Hovor – Jan Novák" / při chybějícím klientovi popis
  const co = [typLabel, parent?.klient || popis?.slice(0, 80)].filter(Boolean).join(' – ')
  const kontextKratky = parent?.druh === 'DEAL' ? (activity.deal?.kod || activity.deal?.predmet) : parent?.druh === 'LEAD' ? 'lead' : null

  await createNotification({
    orgId: activity.orgId,
    userId: prijemce.id,
    typ: 'PRIPOMINKA',
    zprava: `Připomínka: ${co}${parent?.klient && popis ? `: ${popis.slice(0, 80)}` : ''}${kontextKratky ? ` (${kontextKratky})` : ''}`,
    dealId: activity.dealId ?? undefined,
    url: parent?.druh === 'LEAD' ? parent.href : undefined,
  })

  if (!isEmailConfigured() || !prijemce.email || !prijemce.aktivni) return 'bell-only'

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const url = `https://${activity.organization.slug}.${rootDomain}${parent?.href ?? '/activities'}`
  const termin =
    new Intl.DateTimeFormat('cs-CZ', { dateStyle: 'medium', timeZone: 'Europe/Prague' }).format(activity.datum) +
    (activity.cas ? ` v ${activity.cas}` : '')

  try {
    await sendEmail(
      prijemce.email,
      `Připomínka: ${co}`,
      emailActivityReminder({
        jmeno: prijemce.jmeno,
        typLabel,
        popis,
        klient: parent?.klient ?? '',
        kontextLabel: parent?.kontextLabel ?? 'Obchodní případ',
        kontext: parent?.druh === 'DEAL' ? parent.kontext : null,
        termin,
        url,
      }),
    )
  } catch (err) {
    console.error(`[reminders] email pro aktivitu ${activityId} selhal:`, err)
    return 'email-failed'
  }
  return 'sent'
}
