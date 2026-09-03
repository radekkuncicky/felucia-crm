import { describe, it, expect, beforeAll, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))
// E-maily se v testech nesmí reálně odesílat (prod .env má SMTP) — a fallback
// odkazů se testuje právě pro stav „e-mail není nakonfigurován / nedorazil"
vi.mock('@/lib/email', () => ({
  sendEmail: vi.fn(),
  sendOrgEmail: vi.fn(),
  emailWelcome: vi.fn(() => ''),
  emailResetPassword: vi.fn(() => ''),
  emailTechnikInvite: vi.fn(() => ''),
  isEmailConfigured: () => false,
  isOrgEmailConfigured: vi.fn(async () => false),
}))

import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { POST as registerPost } from '@/app/api/auth/register/route'
import { POST as invitePost } from '@/app/api/onboarding/invite/route'
import { POST as usersPost } from '@/app/api/settings/users/route'
import { POST as resetPost } from '@/app/api/settings/users/reset-password/route'

const RUN = `orgdef-${Date.now()}`

function jsonReq(url: string, body: unknown) {
  return new NextRequest(`http://localhost${url}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`,
    },
    body: JSON.stringify(body),
  })
}

describe('registrace → výchozí obsah nové organizace', () => {
  let orgId: string

  beforeAll(async () => {
    const res = await registerPost(jsonReq('/api/auth/register', {
      nazevFirmy: `Org Defaults ${RUN}`,
      jmeno: 'Test',
      prijmeni: 'Admin',
      email: `admin@${RUN}.cz`,
      heslo: 'tajneheslo123',
      slug: RUN,
    }))
    expect(res.status).toBe(201)
    const data = await res.json()
    orgId = data.orgId
  })

  it('založí výchozí renderovací šablonu nabídky s configem', async () => {
    const templates = await prisma.quoteTemplate.findMany({
      where: { orgId },
      include: { config: true },
    })
    expect(templates).toHaveLength(1)
    expect(templates[0].nazev).toBe('Základní nabídka')
    expect(templates[0].typ).toBe('BASE')
    expect(templates[0].isDefault).toBe(true)
    expect(templates[0].config?.primaryColor).toBe('#4CAF50')
  })

  it('založí vzorovou smlouvu o dílo s placeholdery', async () => {
    const templates = await prisma.contractTemplate.findMany({ where: { orgId } })
    expect(templates).toHaveLength(1)
    expect(templates[0].nazev).toContain('Smlouva o dílo')
    expect(templates[0].typSablony).toBe('text')
    expect(templates[0].popis).toContain('právníkem')
    for (const ph of ['{{cislo_smlouvy}}', '{{organizace}}', '{{klient_jmeno}}', '{{predmet}}', '{{konecna_cena}}', '{{cena_s_dph}}', '{{hodnota_zalohy}}', '{{datum}}']) {
      expect(templates[0].obsah).toContain(ph)
    }
  })
})

describe('pozvánky a reset hesla — fallback odkaz bez e-mailu', () => {
  let orgId: string
  let adminId: string

  beforeAll(async () => {
    const org = await prisma.organization.create({
      data: { nazev: `Invite ${RUN}`, slug: `${RUN}-inv`, plan: 'STANDARD' },
    })
    orgId = org.id
    const admin = await prisma.user.create({
      data: { orgId, jmeno: 'Admin', email: `boss@${RUN}.cz`, hesloHash: 'x', role: 'ADMIN' },
    })
    adminId = admin.id
    vi.mocked(getServerSession).mockResolvedValue({
      user: { id: adminId, orgId, role: 'ADMIN', plan: 'STANDARD' },
    } as never)
  })

  it('onboarding pozvánka bez SMTP vytvoří účet a vrátí odkaz', async () => {
    const res = await invitePost(jsonReq('/api/onboarding/invite', { emails: [`kolega@${RUN}.cz`] }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.sent).toHaveLength(1)
    expect(data.sent[0].email).toBe(`kolega@${RUN}.cz`)
    expect(data.sent[0].emailSent).toBe(false)
    expect(data.sent[0].inviteUrl).toContain('/magic-link?token=')

    const user = await prisma.user.findFirst({ where: { orgId, email: `kolega@${RUN}.cz` } })
    expect(user).not.toBeNull()
    const token = await prisma.magicLinkToken.findFirst({ where: { userId: user!.id } })
    expect(token).not.toBeNull()
  })

  it('pozvánka technika bez SMTP vrátí odkaz na nastavení hesla', async () => {
    const res = await usersPost(jsonReq('/api/settings/users', {
      jmeno: 'Technik Test',
      email: `technik@${RUN}.cz`,
      role: 'TECHNIK',
    }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inviteEmailSent).toBe(false)
    expect(data.inviteUrl).toContain('/reset-password?token=')
    expect(data.inviteUrl).toContain(`${RUN}-inv.`)

    const token = await prisma.passwordResetToken.findFirst({ where: { userId: data.id } })
    expect(token).not.toBeNull()
  })

  it('reset hesla bez SMTP vrátí ok + odkaz místo chyby 500', async () => {
    const res = await resetPost(jsonReq('/api/settings/users/reset-password', { userId: adminId }))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.ok).toBe(true)
    expect(data.emailSent).toBe(false)
    expect(data.resetUrl).toContain('/reset-password?token=')
    expect(data.resetUrl).toContain(`${RUN}-inv.`)
  })
})
