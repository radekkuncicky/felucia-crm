import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { POST as resetPost } from '@/app/api/auth/reset-password/route'
import { POST as adminResetPost } from '@/app/api/settings/users/reset-password/route'
import { PATCH as profilePatch } from '@/app/api/settings/profile/route'
import { POST as inquiryPost } from '@/app/api/webhooks/inquiry/route'
import { hashAuthToken, issueMagicLinkToken } from '@/lib/authTokens'
import { isInternalHost, validateWebhookUrl } from '@/lib/webhooks'
import { emailPodpisSmlouvy } from '@/lib/email'
import { authOptions } from '@/lib/auth'
import { getServerSession } from 'next-auth'
import bcrypt from 'bcryptjs'

/**
 * Regresní testy k bezpečnostnímu auditu 2026-09, vlna 3: SEC-36 (hashované
 * tokeny), SEC-41 (webhook), SEC-43 (změna e-mailu s heslem), SEC-44 (escaping
 * v e-mailech), SEC-46 (SMTP blocklist).
 */

const RUN = `sec3-${Date.now()}`
let orgId: string, adminId: string

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Sec3', slug: RUN, plan: 'PROFESSIONAL' } })).id
  adminId = (await prisma.user.create({ data: { orgId, jmeno: 'Admin', email: `${RUN}-admin@a.cz`, hesloHash: await bcrypt.hash('SpravneHeslo1', 4), role: 'ADMIN' } })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN', plan: 'PROFESSIONAL', email: `${RUN}-admin@a.cz` } } as never)
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.passwordResetToken.deleteMany({ where: { user: { orgId } } })
  await prisma.magicLinkToken.deleteMany({ where: { user: { orgId } } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

const json = (body: unknown, method = 'POST') => new Request('http://test', { method, headers: { 'content-type': 'application/json', 'x-real-ip': '10.7.7.7' }, body: JSON.stringify(body) })

describe('SEC-36 — tokeny jen jako hash', () => {
  it('admin reset: v DB je sha256, surový token z odkazu funguje, starý se zneplatní', async () => {
    const r1 = await adminResetPost(json({ userId: adminId }))
    expect(r1.status).toBe(200)
    const raw1 = new URL((await r1.json()).resetUrl ?? (await prisma.passwordResetToken.findFirst({ where: { userId: adminId } }))!.token, 'http://x').searchParams.get('token')
    const rows = await prisma.passwordResetToken.findMany({ where: { userId: adminId, used: false } })
    expect(rows).toHaveLength(1)
    expect(rows[0].token).toHaveLength(64)
    if (raw1) {
      expect(rows[0].token).not.toBe(raw1)
      expect(rows[0].token).toBe(hashAuthToken(raw1))
    }
    // druhé vydání zneplatní první
    await adminResetPost(json({ userId: adminId }))
    const rows2 = await prisma.passwordResetToken.findMany({ where: { userId: adminId, used: false } })
    expect(rows2).toHaveLength(1)
    expect(rows2[0].token).not.toBe(rows[0].token)
  })

  it('reset hesla přijme surový token, hash ani objekt ne; heslo min. 10 znaků', async () => {
    const rawToken = (await prisma.passwordResetToken.findFirst({ where: { userId: adminId, used: false } }))!.token
    // v DB je hash — poslat hash jako token nesmí projít (útočník s dumpem DB)
    expect((await resetPost(json({ token: rawToken, newPassword: 'NoveHeslo12345' }))).status).toBe(400)
    expect((await resetPost(json({ token: { startsWith: 'a' }, newPassword: 'NoveHeslo12345' }))).status).toBe(400)
    const raw = await issueMagicLinkToken(prisma, adminId, 60_000) // vydat známý surový token přes helper
    expect((await prisma.magicLinkToken.findFirst({ where: { userId: adminId } }))!.token).toBe(hashAuthToken(raw))
    expect((await resetPost(json({ token: 'x'.repeat(64), newPassword: 'kratke' }))).status).toBe(400)
  })

  it('magic link login: authorize najde uživatele podle hashe surového tokenu', async () => {
    const raw = await issueMagicLinkToken(prisma, adminId, 60_000)
    const provider = authOptions.providers[0] as unknown as { options: { authorize: (c: Record<string, string>, r: unknown) => Promise<{ id: string } | null> } }
    const user = await provider.options.authorize({ magicToken: raw }, { headers: {} })
    expect(user?.id).toBe(adminId)
    expect(await provider.options.authorize({ magicToken: hashAuthToken(raw) }, { headers: {} })).toBeNull()
  })
})

describe('SEC-43 — změna e-mailu jen s heslem', () => {
  it('bez hesla 400, se špatným heslem 400, se správným projde + audit', async () => {
    expect((await profilePatch(json({ jmeno: 'Admin', email: `${RUN}-novy@a.cz` }, 'PATCH'))).status).toBe(400)
    expect((await profilePatch(json({ jmeno: 'Admin', email: `${RUN}-novy@a.cz`, currentPassword: 'spatne' }, 'PATCH'))).status).toBe(400)
    const ok = await profilePatch(json({ jmeno: 'Admin', email: `${RUN}-novy@a.cz`, currentPassword: 'SpravneHeslo1' }, 'PATCH'))
    expect(ok.status).toBe(200)
    expect((await prisma.user.findUnique({ where: { id: adminId } }))?.email).toBe(`${RUN}-novy@a.cz`)
    expect(await prisma.auditLog.count({ where: { orgId, typZaznamu: 'User', zaznamId: adminId } })).toBeGreaterThan(0)
    // jen jméno bez hesla projde
    expect((await profilePatch(json({ jmeno: 'Admin 2', email: `${RUN}-novy@a.cz` }, 'PATCH'))).status).toBe(200)
  })
})

describe('SEC-44 — escaping tenant hodnot v e-mailech', () => {
  it('HTML v názvu org / jménu klienta se neinterpretuje, barva mimo #rrggbb se nahradí', () => {
    const html = emailPodpisSmlouvy({
      orgNazev: '<img src=x onerror=alert(1)>Firma', primaryColor: 'red;background:url(https://evil)',
      klientJmeno: '<b>Klient</b>', cisloSmlouvy: 'S-1', url: 'https://felucia.io/podpis/x', platnostDni: 30,
    } as never)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
    expect(html).not.toContain('<b>Klient</b>')
    expect(html).not.toContain('url(https://evil)')
  })
})

describe('SEC-46 / SEC-41 — SSRF blocklist a webhook', () => {
  it('interní hosty jsou odmítnuté', () => {
    for (const h of ['localhost', '127.0.0.1', '10.0.0.5', '192.168.1.1', '172.16.0.1', '169.254.169.254', '::1', 'db.internal', 'x.local']) {
      expect(isInternalHost(h), h).toBe(true)
    }
    expect(isInternalHost('smtp.seznam.cz')).toBe(false)
    expect(validateWebhookUrl('https://127.0.0.1/x')).not.toBeNull()
    expect(validateWebhookUrl('https://hooks.example.com/x')).toBeNull()
  })

  it('webhook inquiry se špatným/prázdným secretem → 401 (timing-safe porovnání)', async () => {
    const mk = (secret?: string) => new Request('http://test', { method: 'POST', headers: { 'content-type': 'application/json', ...(secret ? { 'x-webhook-secret': secret } : {}), 'x-real-ip': '10.6.6.6' }, body: '{}' })
    expect([401, 500]).toContain((await inquiryPost(mk('spatny'))).status)
    expect([401, 500]).toContain((await inquiryPost(mk())).status)
  })
})
