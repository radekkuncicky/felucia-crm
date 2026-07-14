import 'dotenv/config'
import PgBoss from 'pg-boss'
import { prisma } from '../lib/prisma'
import { findDueReminders, processReminder } from './reminders'
import { sweepWebhookOutbox, deliverWebhook } from './webhooks'
import { sweepExpirovanePodpisy } from './podpisy'
import { QUEUE_WEBHOOK_SWEEP, QUEUE_WEBHOOK_DELIVER, type WebhookJob } from '../lib/webhooks'

/**
 * Background worker (PM2 proces nanto-crm-worker, samostatný od Next.js).
 * pg-boss běží nad stejnou PostgreSQL ve vlastním schématu `pgboss`.
 *
 * Fronty:
 *  - reminders-sweep   cron každou minutu, zařadí zralé připomínky
 *  - activity-reminder zpracování jedné připomínky (bell + email)
 *  - webhooks-sweep    cron každou minutu, vymete webhook_outbox
 *  - webhook-deliver   doručení jedné události na jeden endpoint
 */

const QUEUE_SWEEP = 'reminders-sweep'
const QUEUE_REMINDER = 'activity-reminder'

async function main() {
  const boss = new PgBoss({
    connectionString: process.env.DATABASE_URL!,
    schema: 'pgboss',
    max: 5,
  })
  boss.on('error', (err) => console.error('[pg-boss]', err))
  await boss.start()

  await boss.createQueue(QUEUE_SWEEP)
  await boss.createQueue(QUEUE_REMINDER)
  await boss.schedule(QUEUE_SWEEP, '* * * * *')

  await boss.work(QUEUE_SWEEP, async () => {
    const due = await findDueReminders(prisma)
    for (const a of due) {
      // singletonKey: tatáž aktivita se nezařadí dvakrát, dokud job čeká
      await boss.send(QUEUE_REMINDER, { activityId: a.id }, { singletonKey: a.id, retryLimit: 3, retryDelay: 60 })
    }
    if (due.length > 0) console.log(`[sweep] zařazeno ${due.length} připomínek`)
  })

  await boss.work<{ activityId: string }>(QUEUE_REMINDER, async ([job]) => {
    const result = await processReminder(prisma, job.data.activityId)
    console.log(`[reminder] aktivita ${job.data.activityId}: ${result}`)
  })

  await boss.createQueue(QUEUE_WEBHOOK_SWEEP)
  await boss.createQueue(QUEUE_WEBHOOK_DELIVER)
  await boss.schedule(QUEUE_WEBHOOK_SWEEP, '* * * * *')

  await boss.work(QUEUE_WEBHOOK_SWEEP, async () => {
    const n = await sweepWebhookOutbox(prisma, (job, opts) =>
      boss.send(QUEUE_WEBHOOK_DELIVER, job, {
        ...opts,
        retryLimit: 5,
        retryDelay: 60,
        retryBackoff: true,
        expireInSeconds: 30,
      })
    )
    if (n > 0) console.log(`[webhooks] zařazeno ${n} doručení`)
  })

  await boss.work<WebhookJob>(QUEUE_WEBHOOK_DELIVER, async ([job]) => {
    const result = await deliverWebhook(prisma, job.data)
    console.log(`[webhook] ${job.data.event} → endpoint ${job.data.endpointId}: ${result}`)
  })

  const QUEUE_PODPISY_SWEEP = 'podpisy-sweep'
  await boss.createQueue(QUEUE_PODPISY_SWEEP)
  await boss.schedule(QUEUE_PODPISY_SWEEP, '15 * * * *') // 1× za hodinu stačí, odkazy platí 30 dní

  await boss.work(QUEUE_PODPISY_SWEEP, async () => {
    const n = await sweepExpirovanePodpisy(prisma)
    if (n > 0) console.log(`[podpisy] expirováno ${n} podpisových odkazů`)
  })

  console.log('[worker] běží — fronty:', QUEUE_SWEEP, QUEUE_REMINDER, QUEUE_WEBHOOK_SWEEP, QUEUE_WEBHOOK_DELIVER, QUEUE_PODPISY_SWEEP)

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal}, ukončuji…`)
    await boss.stop({ wait: true, timeout: 10_000 })
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((err) => {
  console.error('[worker] start selhal:', err)
  process.exit(1)
})
