import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@/lib/prisma'
import { orgPrisma } from '@/lib/orgPrisma'
import { logAction } from '@/lib/auditLog'
import { anonymizedClientData } from '@/lib/clientAnonymize'
import { sweepWebhookOutbox } from '@/worker/webhooks'
import type { WebhookJob } from '@/lib/webhooks'

/**
 * GDPR anonymizace klienta nad nanto_crm_test: hard delete klienta s historií
 * není možný (Client -> Deal/Zakazka atd. bez cascade), takže se PII nahrazuje
 * placeholderem a vazby na obchodní záznamy zůstávají nedotčené. Mimikuje
 * přesně to, co dělá POST /api/clients/[id]/anonymize (viz route.ts).
 */

const RUN = `anon-${Date.now()}`

let orgA: { id: string }
let orgB: { id: string }
let clientA: { id: string }
let dealA: { id: string }

beforeAll(async () => {
  orgA = await prisma.organization.create({ data: { nazev: 'Test Anon A', slug: `${RUN}-a` } })
  orgB = await prisma.organization.create({ data: { nazev: 'Test Anon B', slug: `${RUN}-b` } })
  const client = await prisma.client.create({
    data: {
      orgId: orgA.id,
      jmeno: 'Petr',
      prijmeni: 'Původní',
      telefon: '777123456',
      email: 'petr@puvodni.cz',
      ulice: 'Hlavní 1',
      mesto: 'Ostrava',
      psc: '702 00',
      ico: '12345678',
      dic: 'CZ12345678',
      poznamka: 'VIP klient',
    },
  })
  clientA = { id: client.id }
  const deal = await prisma.deal.create({
    data: { orgId: orgA.id, clientId: clientA.id, technologie: 'KLIMA', kod: `OP-${RUN}` },
  })
  dealA = { id: deal.id }
})

afterAll(async () => {
  const orgIds = [orgA.id, orgB.id]
  await prisma.webhookOutbox.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.auditLog.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('anonymizedClientData', () => {
  it('nahradí PII placeholderem a nastaví anonymizedAt', () => {
    const data = anonymizedClientData(clientA.id)
    expect(data.jmeno).toMatch(/^Smazaný klient #/)
    expect(data.prijmeni).toBe('')
    expect(data.telefon).toBeNull()
    expect(data.email).toBe('anonymized@deleted.local')
    expect(data.ulice).toBeNull()
    expect(data.mesto).toBeNull()
    expect(data.psc).toBeNull()
    expect(data.ico).toBeNull()
    expect(data.dic).toBeNull()
    expect(data.poznamka).toBeNull()
    expect(data.anonymizedAt).toBeInstanceOf(Date)
  })
})

describe('anonymizace přes orgPrisma (RLS)', () => {
  // endpoint před anonymizací, aby trigger opravdu zapisoval do outboxu (jinak by no-op)
  beforeAll(async () => {
    await prisma.webhookEndpoint.create({
      data: { orgId: orgA.id, nazev: 'test', url: 'https://example.com/hook', secret: 's', events: ['client.updated'], aktivni: true },
    })
  })

  it('PII zmizí, vazba na Deal zůstane zachovaná', async () => {
    const db = orgPrisma(orgA.id)
    const anonymized = await db.client.update({
      where: { id: clientA.id, orgId: orgA.id },
      data: anonymizedClientData(clientA.id),
    })

    expect(anonymized.jmeno).toMatch(/^Smazaný klient #/)
    expect(anonymized.email).toBe('anonymized@deleted.local')
    expect(anonymized.telefon).toBeNull()
    expect(anonymized.ico).toBeNull()
    expect(anonymized.anonymizedAt).not.toBeNull()

    const deal = await prisma.deal.findUnique({ where: { id: dealA.id } })
    expect(deal?.clientId).toBe(clientA.id)
  })

  it('org B nemůže anonymizovaného klienta org A ani vidět', async () => {
    const dbB = orgPrisma(orgB.id)
    const found = await dbB.client.findFirst({ where: { id: clientA.id, orgId: orgB.id } })
    expect(found).toBeNull()
  })

  it('audit log zaznamená akci anonymizace', async () => {
    await logAction({
      orgId: orgA.id,
      typAkce: 'UPDATE',
      typZaznamu: 'Client',
      zaznamId: clientA.id,
      zaznamNazev: 'Anonymizace klienta (dříve: Petr Původní)',
      zmeny: { action: 'anonymize' },
    })
    const logs = await prisma.auditLog.findMany({ where: { orgId: orgA.id, zaznamId: clientA.id } })
    expect(logs.some((l) => (l.zmeny as { action?: string })?.action === 'anonymize')).toBe(true)
  })

  it('webhook outbox z anonymizačního UPDATE obsahuje nové (anonymizované) hodnoty, ne staré PII', async () => {
    const rows = await prisma.webhookOutbox.findMany({ where: { orgId: orgA.id, event: 'client.updated' } })
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) {
      const payload = row.payload as { email: string; telefon: string | null; jmeno: string }
      expect(payload.email).toBe('anonymized@deleted.local')
      expect(payload.telefon).toBeNull()
      expect(payload.jmeno).toMatch(/^Smazaný klient #/)
      expect(payload.jmeno).not.toBe('Petr')
    }

    // sweep by odeslal jen anonymizovaný payload dál, nikdy starou PII
    const jobs: WebhookJob[] = []
    await sweepWebhookOutbox(prisma, async (job) => { jobs.push(job) })
    for (const job of jobs) {
      const payload = job.payload as { email: string }
      expect(payload.email).toBe('anonymized@deleted.local')
    }
  })
})
