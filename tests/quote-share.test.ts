import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import {
  ensureQuoteShare,
  getQuoteShare,
  revokeQuoteShare,
  loadQuoteByShareToken,
  quoteShareUrl,
} from '@/lib/quoteShare'

/**
 * Integrační test veřejného sdílení nabídek nad nanto_crm_test:
 * vytvoření/reuse tokenu, expirace, revokace, tenant izolace.
 */

const RUN = `qshare-${Date.now()}`

let org: { id: string }
let cizzyOrg: { id: string }
let quoteId: string

beforeAll(async () => {
  if (!process.env.CREDENTIALS_ENCRYPTION_KEY) {
    process.env.CREDENTIALS_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex')
  }

  org = await prisma.organization.create({ data: { nazev: 'Share Test', slug: RUN } })
  cizzyOrg = await prisma.organization.create({ data: { nazev: 'Cizí org', slug: `${RUN}-b` } })

  const client = await prisma.client.create({
    data: { orgId: org.id, jmeno: 'Karel', prijmeni: 'Novák' },
  })
  const deal = await prisma.deal.create({
    data: { orgId: org.id, clientId: client.id, technologie: 'KLIMA' },
  })
  const quote = await prisma.quote.create({
    data: { orgId: org.id, dealId: deal.id, nazev: 'Varianta A' },
  })
  quoteId = quote.id
})

afterAll(async () => {
  const orgIds = [org.id, cizzyOrg.id]
  await prisma.quote.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.deal.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.client.deleteMany({ where: { orgId: { in: orgIds } } })
  await prisma.organization.deleteMany({ where: { id: { in: orgIds } } })
  await prisma.$disconnect()
})

describe('quoteShare', () => {
  it('ensureQuoteShare vytvoří token a opakované volání vrací stejný odkaz', async () => {
    const first = await ensureQuoteShare(quoteId, org.id)
    expect(first).not.toBeNull()
    expect(first!.token.length).toBeGreaterThan(30)
    expect(first!.expiresAt.getTime()).toBeGreaterThan(Date.now())

    const second = await ensureQuoteShare(quoteId, org.id)
    expect(second!.token).toBe(first!.token)

    const status = await getQuoteShare(quoteId, org.id)
    expect(status!.token).toBe(first!.token)
  })

  it('v DB je jen hash, ne token', async () => {
    const share = await getQuoteShare(quoteId, org.id)
    const quote = await prisma.quote.findUnique({ where: { id: quoteId } })
    expect(quote?.shareTokenHash).toBeTruthy()
    expect(quote?.shareTokenHash).not.toBe(share!.token)
    expect(quote?.shareTokenEnc).not.toContain(share!.token)
  })

  it('loadQuoteByShareToken najde nabídku bez org kontextu', async () => {
    const share = await getQuoteShare(quoteId, org.id)
    const loaded = await loadQuoteByShareToken(share!.token)
    expect(loaded?.quoteId).toBe(quoteId)
    expect(loaded?.orgId).toBe(org.id)
    expect(loaded?.clientJmeno).toBe('Karel')
  })

  it('neplatný token nic nenajde', async () => {
    expect(await loadQuoteByShareToken('neexistujici-token-xyz-123456')).toBeNull()
    expect(await loadQuoteByShareToken('')).toBeNull()
  })

  it('cizí org nabídku nesdílí (tenant izolace)', async () => {
    expect(await ensureQuoteShare(quoteId, cizzyOrg.id)).toBeNull()
    expect(await getQuoteShare(quoteId, cizzyOrg.id)).toBeNull()
    expect(await revokeQuoteShare(quoteId, cizzyOrg.id)).toBe(false)
  })

  it('po expiraci odkaz neplatí a ensure vygeneruje nový token', async () => {
    const before = await getQuoteShare(quoteId, org.id)
    await prisma.quote.update({
      where: { id: quoteId },
      data: { shareExpiresAt: new Date(Date.now() - 1000) },
    })

    expect(await loadQuoteByShareToken(before!.token)).toBeNull()
    expect(await getQuoteShare(quoteId, org.id)).toBeNull()

    const renewed = await ensureQuoteShare(quoteId, org.id)
    expect(renewed!.token).not.toBe(before!.token)
    expect(await loadQuoteByShareToken(renewed!.token)).not.toBeNull()
  })

  it('revoke zneplatní odkaz', async () => {
    const share = await getQuoteShare(quoteId, org.id)
    expect(await revokeQuoteShare(quoteId, org.id)).toBe(true)
    expect(await loadQuoteByShareToken(share!.token)).toBeNull()
    expect(await getQuoteShare(quoteId, org.id)).toBeNull()
  })

  it('quoteShareUrl skládá URL z org slugu', () => {
    expect(quoteShareUrl('nanto', 'abc')).toMatch(/^https:\/\/nanto\..+\/nabidka\/abc$/)
  })
})
