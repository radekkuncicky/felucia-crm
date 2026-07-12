import type { PrismaClient } from '@prisma/client'
import { signWebhookBody, validateWebhookUrl, type WebhookJob } from '../lib/webhooks'

/**
 * Doručování webhooků: sweep vymete webhook_outbox (plní ho DB triggery)
 * a pro každou událost zařadí job per odebírající endpoint. Pořadí je
 * send → delete, takže sémantika je at-least-once — při pádu mezi nimi
 * se událost zařadí znovu (singletonKey duplikáty tlumí, dokud job čeká).
 */

const SWEEP_BATCH = 200
const DELIVER_TIMEOUT_MS = 10_000

type Enqueue = (job: WebhookJob, opts: { singletonKey: string }) => Promise<unknown>

export async function sweepWebhookOutbox(prisma: PrismaClient, enqueue: Enqueue): Promise<number> {
  const rows = await prisma.webhookOutbox.findMany({
    orderBy: { id: 'asc' },
    take: SWEEP_BATCH,
  })
  if (rows.length === 0) return 0

  const orgIds = Array.from(new Set(rows.map((r) => r.orgId)))
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { orgId: { in: orgIds }, aktivni: true },
    select: { id: true, orgId: true, events: true },
  })

  let enqueued = 0
  for (const row of rows) {
    const outboxId = row.id.toString()
    for (const ep of endpoints) {
      if (ep.orgId !== row.orgId || !ep.events.includes(row.event)) continue
      const job: WebhookJob = {
        endpointId: ep.id,
        outboxId,
        event: row.event,
        orgId: row.orgId,
        createdAt: row.vytvoreno.toISOString(),
        payload: row.payload,
      }
      await enqueue(job, { singletonKey: `${outboxId}:${ep.id}` })
      enqueued++
    }
  }

  await prisma.webhookOutbox.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } })
  return enqueued
}

export type DeliverResult = 'delivered' | 'skipped'

/**
 * Doručí jednu událost na jeden endpoint. Neúspěch (HTTP != 2xx, timeout,
 * síťová chyba) vyhodí výjimku → pg-boss retry; smazaný/vypnutý endpoint
 * nebo nevalidní URL se přeskočí bez retry.
 */
export async function deliverWebhook(prisma: PrismaClient, job: WebhookJob): Promise<DeliverResult> {
  const endpoint = await prisma.webhookEndpoint.findUnique({ where: { id: job.endpointId } })
  if (!endpoint || !endpoint.aktivni) return 'skipped'

  const urlError = validateWebhookUrl(endpoint.url)
  if (urlError) {
    await recordError(prisma, endpoint.id, urlError)
    return 'skipped'
  }

  const body = JSON.stringify({
    id: job.outboxId,
    event: job.event,
    orgId: job.orgId,
    createdAt: job.createdAt,
    data: job.payload,
  })

  let res: Response
  try {
    res = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Felucia-Webhooks/1.0',
        'X-Felucia-Event': job.event,
        'X-Felucia-Signature': signWebhookBody(endpoint.secret, body),
      },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(DELIVER_TIMEOUT_MS),
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    await recordError(prisma, endpoint.id, msg)
    throw new Error(`webhook ${endpoint.id}: ${msg}`)
  }

  if (!res.ok) {
    await recordError(prisma, endpoint.id, `HTTP ${res.status}`)
    throw new Error(`webhook ${endpoint.id}: HTTP ${res.status}`)
  }

  await prisma.webhookEndpoint.update({
    where: { id: endpoint.id },
    data: { lastSuccessAt: new Date(), lastErrorAt: null, lastError: null },
  })
  return 'delivered'
}

async function recordError(prisma: PrismaClient, endpointId: string, message: string) {
  await prisma.webhookEndpoint
    .update({
      where: { id: endpointId },
      data: { lastErrorAt: new Date(), lastError: message.slice(0, 500) },
    })
    .catch(() => undefined) // endpoint mohl mezitím zmizet
}
