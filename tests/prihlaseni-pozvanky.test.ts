import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { getServerSession } from 'next-auth'
import { POST as usersPost } from '@/app/api/settings/users/route'
import { PATCH as userPatch, DELETE as userDelete } from '@/app/api/settings/users/[id]/route'
import { POST as adminResetPost } from '@/app/api/settings/users/reset-password/route'
import { GET as resetGet, POST as resetPost } from '@/app/api/auth/reset-password/route'
import { POST as forgotPost } from '@/app/api/auth/forgot-password/route'
import { POST as mobileLogin } from '@/app/api/auth/mobile/login/route'
import { authOptions } from '@/lib/auth'
import { normalizeEmail, passwordError } from '@/lib/authInput'
import { issuePasswordResetToken } from '@/lib/authTokens'
import bcrypt from 'bcryptjs'

/**
 * Hladký start nového uživatele (audit 2026-11-23): normalizace e-mailu,
 * pozvánka pro všechny role, nastavení hesla z pozvánky, deaktivace,
 * zrušení pozvánky, srozumitelné chyby přihlášení.
 */

const RUN = `prih-${Date.now()}`
let orgId: string, adminId: string
let ip = 0
const json = (body: unknown, method = 'POST', url = 'http://test') =>
  new Request(url, { method, headers: { 'content-type': 'application/json', 'x-real-ip': `10.9.${Math.floor(++ip / 200)}.${ip % 200}` }, body: method === 'GET' ? undefined : JSON.stringify(body) })

type Authorize = (c: Record<string, string>, r: unknown) => Promise<{ id: string } | null>
const authorize: Authorize = (c, r) =>
  (authOptions.providers[0] as unknown as { options: { authorize: Authorize } }).options.authorize(c, r)
const req = () => ({ headers: { 'x-real-ip': `10.8.${Math.floor(++ip / 200)}.${ip % 200}` } })

const rawToken = (url: string) => new URL(url).searchParams.get('token')!

beforeAll(async () => {
  orgId = (await prisma.organization.create({ data: { nazev: 'Přihlášení s.r.o.', slug: RUN, plan: 'STANDARD' } })).id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Šéf', email: `${RUN}-admin@a.cz`, hesloHash: await bcrypt.hash('SpravneHeslo1', 4), role: 'ADMIN', lastLoginAt: new Date() },
  })).id
  vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN', plan: 'STANDARD', jmeno: 'Šéf' } } as never)
})

afterAll(async () => {
  await prisma.auditLog.deleteMany({ where: { orgId } })
  await prisma.passwordResetToken.deleteMany({ where: { user: { orgId } } })
  await prisma.magicLinkToken.deleteMany({ where: { user: { orgId } } })
  await prisma.user.deleteMany({ where: { orgId } })
  await prisma.orgSettings.deleteMany({ where: { orgId } })
  await prisma.organization.delete({ where: { id: orgId } })
})

describe('authInput', () => {
  it('normalizeEmail ořízne a převede na malá písmena', () => {
    expect(normalizeEmail('  Petr.Novak@Firma.CZ ')).toBe('petr.novak@firma.cz')
    expect(normalizeEmail({ startsWith: 'a' })).toBe('')
  })
  it('passwordError: min. 10 znaků, max. 72 bajtů', () => {
    expect(passwordError('kratke')).toMatch(/10/)
    expect(passwordError('dostatecneDlouhe')).toBeNull()
    expect(passwordError('ř'.repeat(40))).toMatch(/dlouhé/)
  })
})

describe('pozvánka obchodníka → nastavení hesla → přihlášení', () => {
  let userId: string, inviteUrl: string

  it('obchodník bez hesla dostane pozvánku, e-mail se uloží malými písmeny', async () => {
    const res = await usersPost(json({ jmeno: 'Petr Novák', email: `  Petr.Novak@${RUN}.CZ `, role: 'OBCHODNIK' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    userId = data.id
    inviteUrl = data.inviteUrl
    expect(data.email).toBe(`petr.novak@${RUN}.cz`)
    expect(data.lastLoginAt).toBeNull()
    expect(inviteUrl).toContain(`https://${RUN}.`)
    expect(inviteUrl).toContain('/reset-password?token=')
    expect(inviteUrl).toContain('pozvanka=1')
    const token = await prisma.passwordResetToken.findFirst({ where: { userId, used: false } })
    expect(token!.expiresAt.getTime() - Date.now()).toBeGreaterThan(6 * 24 * 3600_000)
  })

  it('duplicitní e-mail s jinou velikostí písmen se odmítne', async () => {
    const res = await usersPost(json({ jmeno: 'Petr 2', email: `PETR.NOVAK@${RUN}.cz`, role: 'OBCHODNIK' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/už ve firmě je/)
  })

  it('stránka odkaz ověří hned: pozvánka, e-mail, firma', async () => {
    const res = await resetGet(json(null, 'GET', `http://test/api/auth/reset-password?token=${rawToken(inviteUrl)}`))
    const data = await res.json()
    expect(data.stav).toBe('ok')
    expect(data.prvniPrihlaseni).toBe(true)
    expect(data.email).toBe(`petr.novak@${RUN}.cz`)
    expect(data.orgNazev).toBe('Přihlášení s.r.o.')
  })

  it('nastavení hesla vrátí e-mail pro auto-login; podruhé „použitý“', async () => {
    const res = await resetPost(json({ token: rawToken(inviteUrl), newPassword: 'MojeNoveHeslo1' }))
    expect(res.status).toBe(200)
    expect((await res.json()).email).toBe(`petr.novak@${RUN}.cz`)
    const again = await resetPost(json({ token: rawToken(inviteUrl), newPassword: 'MojeNoveHeslo2' }))
    expect(again.status).toBe(400)
    expect((await again.json()).stav).toBe('pouzity')
    const g = await (await resetGet(json(null, 'GET', `http://test/x?token=${rawToken(inviteUrl)}`))).json()
    expect(g.stav).toBe('pouzity')
  })

  it('souběžné odeslání téhož odkazu projde jen jednou', async () => {
    const raw = await issuePasswordResetToken(prisma, userId, 60_000)
    const [a, b] = await Promise.all([
      resetPost(json({ token: raw, newPassword: 'SoubeznéHeslo1' })),
      resetPost(json({ token: raw, newPassword: 'SoubeznéHeslo2' })),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 400])
    // vrátit známé heslo
    const raw2 = await issuePasswordResetToken(prisma, userId, 60_000)
    expect((await resetPost(json({ token: raw2, newPassword: 'MojeNoveHeslo1' }))).status).toBe(200)
  })

  it('web login: velká písmena a mezery v e-mailu nevadí', async () => {
    const u = await authorize({ email: ` PETR.Novak@${RUN}.cz `, password: 'MojeNoveHeslo1' }, req())
    expect(u?.id).toBe(userId)
  })

  it('mobilní login: velká písmena nevadí, stejná hláška při chybě', async () => {
    const ok = await mobileLogin(json({ email: `Petr.Novak@${RUN}.CZ `, password: 'MojeNoveHeslo1' }))
    expect(ok.status).toBe(200)
    const bad = await mobileLogin(json({ email: `petr.novak@${RUN}.cz`, password: 'spatneHeslo123' }))
    expect(bad.status).toBe(401)
    expect((await bad.json()).error).toBe('Nesprávný e-mail nebo heslo.')
  })

  it('zapomenuté heslo najde účet i při velkých písmenech', async () => {
    await prisma.passwordResetToken.deleteMany({ where: { userId } })
    const res = await forgotPost(json({ email: ` PETR.NOVAK@${RUN}.CZ` }))
    expect(res.status).toBe(200)
    // bez SMTP se token nevydá (nemá kudy odejít) — ověřit, že dotaz nespadl a nic neprozradil
    expect((await res.json()).ok).toBe(true)
    const bad = await forgotPost(json({ email: 'nejde-to' }))
    expect(bad.status).toBe(400)
  })

  it('po přihlášení: admin posílá odkaz na nové heslo (24 h), ne pozvánku; pozvánku už nejde zrušit', async () => {
    const r = await (await adminResetPost(json({ userId }))).json()
    expect(r.pozvanka).toBe(false)
    expect(r.resetUrl).not.toContain('pozvanka=1')
    const t = await prisma.passwordResetToken.findFirst({ where: { userId, used: false } })
    const ttl = t!.expiresAt.getTime() - Date.now()
    expect(ttl).toBeGreaterThan(23 * 3600_000)
    expect(ttl).toBeLessThan(25 * 3600_000)

    const del = await userDelete(json(null, 'DELETE'), { params: { id: userId } })
    expect(del.status).toBe(400)
  })
})

describe('čekající pozvánka: poslat znovu, opravit e-mail, zrušit', () => {
  let userId: string

  it('technik dostane pozvánku; znovu-poslání je zase pozvánka na 7 dní', async () => {
    const data = await (await usersPost(json({ jmeno: 'Tom Technik', email: `tom@${RUN}.cz`, role: 'TECHNIK' }))).json()
    userId = data.id
    const r = await (await adminResetPost(json({ userId }))).json()
    expect(r.pozvanka).toBe(true)
    expect(r.resetUrl).toContain('pozvanka=1')
    const rows = await prisma.passwordResetToken.findMany({ where: { userId, used: false } })
    expect(rows).toHaveLength(1) // starý odkaz zneplatněn
    const g = await (await resetGet(json(null, 'GET', `http://test/x?token=${rawToken(r.resetUrl)}`))).json()
    expect(g.technik).toBe(true)
  })

  it('překlep v e-mailu jde opravit, dokud se nepřihlásil', async () => {
    const res = await userPatch(json({ email: ` Tomas@${RUN}.cz` }, 'PATCH'), { params: { id: userId } })
    expect(res.status).toBe(200)
    expect((await res.json()).email).toBe(`tomas@${RUN}.cz`)
  })

  it('zrušení pozvánky smaže účet', async () => {
    const res = await userDelete(json(null, 'DELETE'), { params: { id: userId } })
    expect(res.status).toBe(200)
    expect(await prisma.user.findUnique({ where: { id: userId } })).toBeNull()
  })

  it('ruční heslo od admina pořád jde (bez pozvánky)', async () => {
    const res = await usersPost(json({ jmeno: 'Ruční', email: `rucni@${RUN}.cz`, role: 'MANAZER', heslo: 'AdminVymyslel1' }))
    expect(res.status).toBe(201)
    const data = await res.json()
    expect(data.inviteUrl).toBeNull()
    expect(await prisma.passwordResetToken.count({ where: { userId: data.id } })).toBe(0)
    expect((await usersPost(json({ jmeno: 'Krátké', email: `kratke@${RUN}.cz`, heslo: 'kratke' }))).status).toBe(400)
  })
})

describe('deaktivace', () => {
  let userId: string

  beforeAll(async () => {
    userId = (await prisma.user.create({
      data: { orgId, jmeno: 'Odchází', email: `odchazi@${RUN}.cz`, hesloHash: await bcrypt.hash('HesloOdchazi1', 4), role: 'TECHNIK', pushToken: 'ExponentPushToken[x]', lastLoginAt: new Date() },
    })).id
    await issuePasswordResetToken(prisma, userId, 7 * 24 * 3600_000)
  })

  it('zneplatní session, smaže push tokeny a nepoužité odkazy', async () => {
    const pred = await prisma.user.findUnique({ where: { id: userId } })
    const res = await userPatch(json({ aktivni: false }, 'PATCH'), { params: { id: userId } })
    expect(res.status).toBe(200)
    const po = await prisma.user.findUnique({ where: { id: userId } })
    expect(po!.sessionVersion).toBe(pred!.sessionVersion + 1)
    expect(po!.pushToken).toBeNull()
    expect(await prisma.passwordResetToken.count({ where: { userId, used: false } })).toBe(0)
  })

  it('přihlášení správným heslem řekne „deaktivovaný“, špatným jen „nesprávné“', async () => {
    await expect(authorize({ email: `odchazi@${RUN}.cz`, password: 'HesloOdchazi1' }, req())).rejects.toThrow('ACCOUNT_DISABLED')
    expect(await authorize({ email: `odchazi@${RUN}.cz`, password: 'SpatneHeslo99' }, req())).toBeNull()
    const m = await mobileLogin(json({ email: `odchazi@${RUN}.cz`, password: 'HesloOdchazi1' }))
    expect(m.status).toBe(401)
    expect((await m.json()).code).toBe('ACCOUNT_DISABLED')
  })

  it('starý odkaz deaktivovaného nejde použít', async () => {
    const raw = await issuePasswordResetToken(prisma, userId, 60_000)
    const g = await (await resetGet(json(null, 'GET', `http://test/x?token=${raw}`))).json()
    expect(g.stav).toBe('neaktivni')
    expect((await resetPost(json({ token: raw, newPassword: 'NoveHesloXYZ1' }))).status).toBe(400)
  })

  it('znovu přidat deaktivovaného → hláška „aktivujte ho“', async () => {
    const res = await usersPost(json({ jmeno: 'Znovu', email: `ODCHAZI@${RUN}.cz`, role: 'TECHNIK' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toMatch(/deaktivovaný/)
  })
})
