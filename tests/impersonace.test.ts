import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { prisma } from '@/lib/prisma'

/**
 * Impersonace superadmina: cookie z dřívějšího přihlášení (odhlášení ji
 * nesmazalo) nesmí po novém přihlášení přepnout superadmina do cizí org.
 */

const jar = new Map<string, string>()
vi.mock('next/headers', () => ({
  cookies: () => ({
    get: (n: string) => (jar.has(n) ? { name: n, value: jar.get(n)! } : undefined),
    delete: (n: string) => { jar.delete(n) },
  }),
}))

import { authOptions } from '@/lib/auth'
import { IMPERSONATE_COOKIE, signCookieValue, type ImpersonateCookie } from '@/lib/impersonate'

const RUN = `imp-${Date.now()}`
let saId: string
let saOrgId: string
let ciziOrgId: string
let ciziAdminId: string

beforeAll(async () => {
  saOrgId = (await prisma.organization.create({ data: { nazev: `SA ${RUN}`, slug: `${RUN}-sa` } })).id
  ciziOrgId = (await prisma.organization.create({ data: { nazev: `Cizí ${RUN}`, slug: `${RUN}-cizi` } })).id
  saId = (await prisma.user.create({ data: { orgId: saOrgId, jmeno: 'Super', email: `${RUN}-sa@example.com`, hesloHash: 'x', role: 'ADMIN', isSuperAdmin: true } })).id
  ciziAdminId = (await prisma.user.create({ data: { orgId: ciziOrgId, jmeno: 'Cizí admin', email: `${RUN}-c@example.com`, hesloHash: 'x', role: 'ADMIN' } })).id
})

afterAll(async () => {
  await prisma.user.deleteMany({ where: { orgId: { in: [saOrgId, ciziOrgId] } } })
  await prisma.organization.deleteMany({ where: { id: { in: [saOrgId, ciziOrgId] } } })
})

function cookie(vytvoreno?: number) {
  const c: ImpersonateCookie = {
    superAdminId: saId, superAdminJmeno: 'Super', orgId: ciziOrgId, orgNazev: 'Cizí', impersonatingUserId: ciziAdminId,
    ...(vytvoreno !== undefined ? { vytvoreno } : {}),
  }
  jar.set(IMPERSONATE_COOKIE, signCookieValue(c, IMPERSONATE_COOKIE))
}

async function session(loginAt?: number) {
  const token = { id: saId, orgId: saOrgId, role: 'ADMIN', jmeno: 'Super', orgSlug: `${RUN}-sa`, plan: 'ENTERPRISE', isSuperAdmin: true, loginAt }
  const s = await authOptions.callbacks!.session!({ session: { user: {} }, token } as never)
  return (s as { user: { orgId: string; impersonating?: boolean; isSuperAdmin: boolean } }).user
}

describe('impersonace superadmina', () => {
  it('impersonace spuštěná po přihlášení přepne do cizí org', async () => {
    const login = Date.now() - 60_000
    cookie(Date.now())
    const u = await session(login)
    expect(u.orgId).toBe(ciziOrgId)
    expect(u.impersonating).toBe(true)
    expect(u.isSuperAdmin).toBe(false)
  })

  it('cookie z doby před přihlášením se ignoruje — superadmin zůstane ve své org', async () => {
    cookie(Date.now() - 60_000)
    const u = await session(Date.now())
    expect(u.orgId).toBe(saOrgId)
    expect(u.impersonating).toBeUndefined()
    expect(u.isSuperAdmin).toBe(true)
  })

  it('stará cookie bez času vzniku se po novém přihlášení ignoruje', async () => {
    cookie()
    expect((await session(Date.now())).orgId).toBe(saOrgId)
  })

  it('přihlášení smaže zbylou impersonační cookie, odhlášení taky', async () => {
    cookie(Date.now())
    await authOptions.callbacks!.jwt!({ token: {}, user: { id: saId, orgId: saOrgId, role: 'ADMIN', jmeno: 'Super', isSuperAdmin: true } } as never)
    expect(jar.has(IMPERSONATE_COOKIE)).toBe(false)

    cookie(Date.now())
    await authOptions.events!.signOut!({ token: {} } as never)
    expect(jar.has(IMPERSONATE_COOKIE)).toBe(false)
  })
})
