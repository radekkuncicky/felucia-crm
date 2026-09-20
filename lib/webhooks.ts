import crypto from 'crypto'

/**
 * Webhooky — transakční outbox:
 *
 * 1. DB triggery (migrace webhook_outbox_triggers, zdroj prisma/webhook-triggers.sql)
 *    zapíšou událost do webhook_outbox ve STEJNÉ transakci jako byznys zápis —
 *    rollback ji zahodí, commit zaručí doručení. Trigger je no-op, pokud org
 *    nemá žádný aktivní webhook endpoint.
 * 2. Worker (worker/webhooks.ts) outbox každou minutu vymete: pro každý řádek
 *    najde odebírající endpointy a zařadí joby do pg-boss fronty webhook-deliver.
 * 3. Doručení: POST JSON { id, event, orgId, createdAt, data } s hlavičkou
 *    X-Felucia-Signature: sha256=<HMAC-SHA256(secret, body)>. Retry 5× s backoffem.
 *
 * Sémantika je at-least-once — příjemce má deduplikovat podle id.
 * Události: <entita>.<created|updated|deleted>, hromadné operace přes
 * updateMany/deleteMany triggery zachytí taky (jsou FOR EACH ROW).
 */

export const QUEUE_WEBHOOK_SWEEP = 'webhooks-sweep'
export const QUEUE_WEBHOOK_DELIVER = 'webhook-deliver'

/** Držet v sync s triggery v prisma/webhook-triggers.sql. */
export const WEBHOOK_EVENTS = [
  'client.created', 'client.updated', 'client.deleted',
  'deal.created', 'deal.updated', 'deal.deleted',
  'zakazka.created', 'zakazka.updated', 'zakazka.deleted',
  'servisni_zakazka.created', 'servisni_zakazka.updated', 'servisni_zakazka.deleted',
  'lead.created', 'lead.updated', 'lead.deleted',
] as const

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

export function isWebhookEvent(ev: string): ev is WebhookEvent {
  return (WEBHOOK_EVENTS as readonly string[]).includes(ev)
}

/** Job ve frontě webhook-deliver — jedna událost pro jeden endpoint. */
export type WebhookJob = {
  endpointId: string
  outboxId: string
  event: string
  orgId: string
  createdAt: string
  payload: unknown
}

export function signWebhookBody(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

/** SSRF ochrana: webhook URL musí být https a nesmí mířit do vnitřní sítě. */
/** Hostname míří do vnitřní sítě / na loopback (SSRF, port scan přes SMTP test apod.) */
export function isInternalHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '')
  return (
    host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost') ||
    /^127\.|^10\.|^192\.168\.|^169\.254\.|^0\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    host === '::1' || host === '::' || host.startsWith('fd') || host.startsWith('fe80') || host.startsWith('::ffff:')
  )
}

export function validateWebhookUrl(raw: string): string | null {
  let u: URL
  try {
    u = new URL(raw)
  } catch {
    return 'Neplatná URL.'
  }
  if (u.protocol !== 'https:') return 'URL musí být https://'
  if (isInternalHost(u.hostname)) {
    return 'URL nesmí mířit do vnitřní sítě.'
  }
  return null
}
