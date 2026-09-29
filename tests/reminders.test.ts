import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { findDueReminders, processReminder } from '@/worker/reminders'
import { emailActivityReminder } from '@/lib/email'

/**
 * Integrační test připomínek aktivit nad nanto_crm_test.
 * SMTP není v testu nakonfigurováno → očekává se bell-only větev.
 */

const RUN = `rem-${Date.now()}`

let org: { id: string }
let user: { id: string }
let deal: { id: string }
let dueId: string
let futureId: string
let doneId: string
let lead: { id: string }
let leadDueId: string

beforeAll(async () => {
  org = await prisma.organization.create({ data: { nazev: 'Test Reminders', slug: RUN } })
  user = await prisma.user.create({
    data: { orgId: org.id, jmeno: 'Rena Reminder', email: `${RUN}@test.cz`, hesloHash: 'x' },
  })
  const client = await prisma.client.create({
    data: { orgId: org.id, jmeno: 'Karel', prijmeni: 'Klient' },
  })
  deal = await prisma.deal.create({
    data: { orgId: org.id, clientId: client.id, technologie: 'KLIMA', kod: `OP-${RUN}` },
  })

  const before = new Date(Date.now() - 60_000)
  const after = new Date(Date.now() + 3_600_000)
  dueId = (await prisma.activity.create({
    data: { orgId: org.id, dealId: deal.id, userId: user.id, resitelId: user.id, typ: 'UKOL', popis: 'Zavolat', datum: new Date(), reminderAt: before },
  })).id
  futureId = (await prisma.activity.create({
    data: { orgId: org.id, dealId: deal.id, userId: user.id, typ: 'HOVOR', datum: new Date(), reminderAt: after },
  })).id
  doneId = (await prisma.activity.create({
    data: { orgId: org.id, dealId: deal.id, userId: user.id, typ: 'HOVOR', datum: new Date(), reminderAt: before, stav: 'DOKONCENA' },
  })).id
  lead = await prisma.lead.create({ data: { orgId: org.id, jmeno: 'Lída Leadová', firma: 'Lída s.r.o.' } })
  leadDueId = (await prisma.activity.create({
    data: { orgId: org.id, leadId: lead.id, userId: user.id, typ: 'EMAIL', popis: 'Poslat ceník', datum: new Date(), reminderAt: before },
  })).id
})

afterAll(async () => {
  await prisma.notification.deleteMany({ where: { orgId: org.id } })
  await prisma.activity.deleteMany({ where: { orgId: org.id } })
  await prisma.lead.deleteMany({ where: { orgId: org.id } })
  await prisma.deal.deleteMany({ where: { orgId: org.id } })
  await prisma.client.deleteMany({ where: { orgId: org.id } })
  await prisma.user.deleteMany({ where: { orgId: org.id } })
  await prisma.organization.delete({ where: { id: org.id } })
  await prisma.$disconnect()
})

describe('findDueReminders', () => {
  it('vrací jen zralé neodeslané připomínky plánovaných aktivit', async () => {
    const ids = (await findDueReminders(prisma)).map((a) => a.id)
    expect(ids).toContain(dueId)
    expect(ids).not.toContain(futureId)
    expect(ids).not.toContain(doneId)
  })
})

describe('processReminder', () => {
  it('vytvoří bell notifikaci a označí reminderSentAt (bez SMTP → bell-only)', async () => {
    expect(await processReminder(prisma, dueId)).toBe('bell-only')

    const activity = await prisma.activity.findUnique({ where: { id: dueId } })
    expect(activity?.reminderSentAt).not.toBeNull()

    const notifications = await prisma.notification.findMany({ where: { orgId: org.id, userId: user.id } })
    expect(notifications).toHaveLength(1)
    expect(notifications[0].typ).toBe('PRIPOMINKA')
    expect(notifications[0].zprava).toContain('Zavolat')
    expect(notifications[0].zprava).toContain('Karel Klient')
    expect(notifications[0].zprava).toContain('Úkol')
    expect(notifications[0].dealId).toBe(deal.id)
  })

  it('druhé zpracování téže aktivity je no-op (žádný duplikát)', async () => {
    expect(await processReminder(prisma, dueId)).toBe('skipped')
    expect(await prisma.notification.count({ where: { orgId: org.id } })).toBe(1)
  })

  it('odeslaná připomínka už není mezi zralými', async () => {
    expect((await findDueReminders(prisma)).map((a) => a.id)).not.toContain(dueId)
  })

  it('připomínka aktivity leadu nese jméno leadu a odkaz na lead', async () => {
    expect(await processReminder(prisma, leadDueId)).toBe('bell-only')
    const n = await prisma.notification.findFirst({ where: { orgId: org.id, url: `/leady/${lead.id}` } })
    expect(n?.dealId).toBeNull()
    expect(n?.zprava).toContain('Lída Leadová (Lída s.r.o.)')
    expect(n?.zprava).toContain('Poslat ceník')
    await prisma.notification.delete({ where: { id: n!.id } })
  })

  it('budoucí ani dokončená aktivita se nezpracuje', async () => {
    expect(await processReminder(prisma, futureId)).toBe('skipped')
    expect(await processReminder(prisma, doneId)).toBe('skipped')
    expect(await prisma.notification.count({ where: { orgId: org.id } })).toBe(1)
  })
})

describe('emailActivityReminder', () => {
  it('obsahuje klienta a escapuje tenant data', () => {
    const html = emailActivityReminder({
      jmeno: 'Rena',
      typLabel: 'Hovor',
      popis: '<script>alert(1)</script>',
      klient: 'Jan <b>Novák</b>',
      kontextLabel: 'Obchodní případ',
      kontext: 'OP-1 · Klima & TČ',
      termin: '1. 10. 2026 v 10:00',
      url: 'https://x.felucia.io/deals/1?tab=aktivity',
    })
    expect(html).toContain('Klient')
    expect(html).toContain('Jan &lt;b&gt;Novák&lt;/b&gt;')
    expect(html).not.toContain('<script>')
    expect(html).toContain('Klima &amp; TČ')
  })
})
