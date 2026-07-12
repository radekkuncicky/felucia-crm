import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { signWebhookBody, validateWebhookUrl, type WebhookJob } from '@/lib/webhooks'
import { sweepWebhookOutbox } from '@/worker/webhooks'

/**
 * Integrační test webhooků nad nanto_crm_test:
 * DB triggery (prisma/webhook-triggers.sql) plní webhook_outbox — i pod RLS
 * rolí nanto_app (zápis přes orgPrisma) — a sweep z něj staví doručovací joby.
 */

const RUN = `wh-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let endpointId: string

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Test Webhooks A', slug: `${RUN}-a` } })
  orgB = await prisma.organization.create({ data: { nazev: 'Test Webhooks B', slug: `${RUN}-b` } })
  endpointId = (
    await prisma.webhookEndpoint.create({
      data: {
        orgId: orgA.id,
        nazev: 'test',
        url: 'https://example.com/hook',
        secret: 'whsec_test',
        events: ['client.created', 'client.deleted'],
      },
    })
  ).id
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.webhookOutbox.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('outbox triggery', () => {
  it('zápis přes orgPrisma (RLS role) vytvoří outbox event created/updated/deleted', async () => {
    const db = orgPrisma(orgA.id)
    const client = await db.client.create({
      data: { orgId: orgA.id, jmeno: 'Věra', prijmeni: 'Webhooková' },
    })
    await db.client.update({ where: { id: client.id }, data: { jmeno: 'Věruška' } })
    await db.client.delete({ where: { id: client.id } })

    const rows = await prisma.webhookOutbox.findMany({
      where: { orgId: orgA.id },
      orderBy: { id: 'asc' },
    })
    expect(rows.map((r) => r.event)).toEqual(['client.created', 'client.updated', 'client.deleted'])
    const payload = rows[0].payload as { id: string; jmeno: string }
    expect(payload.id).toBe(client.id)
    expect(payload.jmeno).toBe('Věra')
  })

  it('org bez aktivního endpointu žádný event negeneruje', async () => {
    await prisma.client.create({ data: { orgId: orgB.id, jmeno: 'Bez', prijmeni: 'Odběru' } })
    const count = await prisma.webhookOutbox.count({ where: { orgId: orgB.id } })
    expect(count).toBe(0)
  })
})

describe('sweepWebhookOutbox', () => {
  it('zařadí joby jen odebírajícím endpointům a outbox vyprázdní', async () => {
    const jobs: WebhookJob[] = []
    const keys: string[] = []
    await sweepWebhookOutbox(prisma, async (job, opts) => {
      jobs.push(job)
      keys.push(opts.singletonKey)
    })

    // endpoint odebírá created+deleted, updated ne
    const events = jobs.filter((j) => j.endpointId === endpointId).map((j) => j.event)
    expect(events).toEqual(['client.created', 'client.deleted'])
    expect(keys).toEqual(jobs.map((j) => `${j.outboxId}:${j.endpointId}`))
    expect(jobs.every((j) => j.orgId === orgA.id)).toBe(true)

    const zbylo = await prisma.webhookOutbox.count({ where: { orgId: { in: [orgA.id, orgB.id] } } })
    expect(zbylo).toBe(0)
  })
})

describe('signWebhookBody', () => {
  it('vrací deterministický HMAC-SHA256 podpis', () => {
    const sig = signWebhookBody('tajne', '{"a":1}')
    expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/)
    expect(sig).toBe(signWebhookBody('tajne', '{"a":1}'))
    expect(sig).not.toBe(signWebhookBody('jine', '{"a":1}'))
  })
})

describe('validateWebhookUrl', () => {
  it('pustí jen veřejné https URL', () => {
    expect(validateWebhookUrl('https://example.com/hook')).toBeNull()
    expect(validateWebhookUrl('http://example.com')).toBeTruthy()
    expect(validateWebhookUrl('not a url')).toBeTruthy()
    expect(validateWebhookUrl('https://localhost/x')).toBeTruthy()
    expect(validateWebhookUrl('https://10.0.0.5/x')).toBeTruthy()
    expect(validateWebhookUrl('https://172.20.1.1/x')).toBeTruthy()
    expect(validateWebhookUrl('https://192.168.1.1/x')).toBeTruthy()
    expect(validateWebhookUrl('https://foo.internal/x')).toBeTruthy()
  })
})
