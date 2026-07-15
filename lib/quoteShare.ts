import crypto from 'crypto'
import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { encryptSecret, decryptSecret } from './secretCrypto'

/**
 * Veřejné sdílení PDF nabídky. Token se ukládá jen jako SHA-256 hash
 * (ověřování) + šifrovaná kopie (opakované zobrazení stejného odkazu),
 * stejný princip jako podpisové relace v lib/sodPodpis.ts.
 */

export const QUOTE_SHARE_DNI = 30

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function quoteShareUrl(orgSlug: string, token: string): string {
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  return `https://${orgSlug}.${rootDomain}/nabidka/${token}`
}

/**
 * Vrátí platné sdílení nabídky, pokud existuje (dešifrovaný token + expirace).
 */
export async function getQuoteShare(
  quoteId: string,
  orgId: string
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = orgPrisma(orgId)
  const quote = await db.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    select: { shareTokenEnc: true, shareExpiresAt: true },
  })
  if (!quote?.shareTokenEnc || !quote.shareExpiresAt) return null
  if (quote.shareExpiresAt < new Date()) return null
  try {
    return { token: decryptSecret(quote.shareTokenEnc), expiresAt: quote.shareExpiresAt }
  } catch {
    return null
  }
}

/**
 * Vytvoří sdílení nabídky, nebo vrátí existující platné (stejný odkaz).
 * Vrací null, když nabídka neexistuje / nepatří org.
 */
export async function ensureQuoteShare(
  quoteId: string,
  orgId: string
): Promise<{ token: string; expiresAt: Date } | null> {
  const db = orgPrisma(orgId)
  const quote = await db.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    select: { id: true },
  })
  if (!quote) return null

  const existing = await getQuoteShare(quoteId, orgId)
  if (existing) return existing

  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + QUOTE_SHARE_DNI * 24 * 60 * 60 * 1000)
  await db.quote.update({
    where: { id: quoteId },
    data: {
      shareTokenHash: sha256(token),
      shareTokenEnc: encryptSecret(token),
      shareExpiresAt: expiresAt,
    },
  })
  return { token, expiresAt }
}

/** Zneplatní veřejný odkaz nabídky. */
export async function revokeQuoteShare(quoteId: string, orgId: string): Promise<boolean> {
  const db = orgPrisma(orgId)
  const quote = await db.quote.findFirst({
    where: { id: quoteId, deal: { orgId } },
    select: { id: true },
  })
  if (!quote) return false
  await db.quote.update({
    where: { id: quoteId },
    data: { shareTokenHash: null, shareTokenEnc: null, shareExpiresAt: null },
  })
  return true
}

/**
 * Veřejné načtení nabídky podle tokenu (bez přihlášení) — bare prisma,
 * volá se před resolvnutím org. Vrací null i při expiraci.
 */
export async function loadQuoteByShareToken(token: string): Promise<{
  quoteId: string
  orgId: string
  orgPlan: string
  kod: string | null
  dealKod: string | null
  technologie: string
  clientJmeno: string
  clientPrijmeni: string
} | null> {
  if (!token || token.length < 20) return null
  const quote = await prisma.quote.findUnique({
    where: { shareTokenHash: sha256(token) },
    select: {
      id: true,
      orgId: true,
      kod: true,
      shareExpiresAt: true,
      deal: {
        select: {
          kod: true,
          technologie: true,
          client: { select: { jmeno: true, prijmeni: true } },
          organization: { select: { plan: true } },
        },
      },
    },
  })
  if (!quote?.shareExpiresAt || quote.shareExpiresAt < new Date()) return null
  return {
    quoteId: quote.id,
    orgId: quote.orgId,
    orgPlan: quote.deal.organization.plan,
    kod: quote.kod,
    dealKod: quote.deal.kod,
    technologie: quote.deal.technologie,
    clientJmeno: quote.deal.client.jmeno,
    clientPrijmeni: quote.deal.client.prijmeni,
  }
}
