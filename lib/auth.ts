import { NextAuthOptions } from 'next-auth'
import { logAction } from './auditLog'
import { hashAuthToken } from './authTokens'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { readImpersonateCookie } from './impersonate'
import { resolvePermissions, ROLE_PRESETS } from './permissions'
import { checkRateLimit } from './rateLimit'

export { loadPermsSnapshot, invalidatePermsCache } from './permsSnapshot'
import { isSessionValid, loadPermsSnapshot, PERMS_REFRESH_MS } from './permsSnapshot'

/** Chyba, kterou jwt callback vyhodí pro zneplatněnou session — NextAuth pak smaže cookie */
const SESSION_INVALID = 'SESSION_INVALID'
const LOGIN_RATE_LIMITED = 'RATE_LIMITED'

/** IP klienta z NextAuth `req` (plain objekt hlaviček za nginx: x-real-ip = $remote_addr, nespoofovatelné) */
function loginClientIp(req: { headers?: Record<string, string | string[] | undefined> } | undefined): string {
  const h = req?.headers ?? {}
  const pick = (k: string) => { const v = h[k]; return Array.isArray(v) ? v[0] : v }
  return pick('x-real-ip')?.trim() || pick('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}

// bcrypt hash náhodného hesla — porovnání proběhne i pro neexistující účet
const DUMMY_HASH = bcrypt.hashSync('dummy-' + Math.random().toString(36), 12)

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
  },
  logger: {
    error(code, metadata) {
      // Zneplatněná session je očekávaný stav, ne chyba
      const msg = (metadata as { message?: string } | undefined)?.message ?? String(metadata)
      if (code === 'JWT_SESSION_ERROR' && msg.includes(SESSION_INVALID)) return
      console.error(`[next-auth][error][${code}]`, metadata)
    },
    warn(code) { console.warn(`[next-auth][warn][${code}]`) },
    debug() {},
  },
  pages: {
    signIn: '/auth/signin',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Heslo', type: 'password' },
        magicToken: { label: 'Magic Token', type: 'text' },
        isDemo: { label: 'Demo', type: 'text' },
      },
      async authorize(credentials, req) {
        // Demo auto-login (no password)
        if (credentials?.isDemo === 'true') {
          const demoUser = await prisma.user.findFirst({
            where: { email: 'demo@felucia.io', aktivni: true },
            include: { organization: { select: { aktivni: true } } },
          })
          if (!demoUser || !demoUser.organization.aktivni) return null
          return {
            id: demoUser.id,
            email: demoUser.email,
            jmeno: demoUser.jmeno,
            orgId: demoUser.orgId,
            role: demoUser.role,
            isSuperAdmin: false,
            isDemo: true,
          }
        }

        // Magic link login
        if (credentials?.magicToken) {
          const token = await prisma.magicLinkToken.findUnique({
            where: { token: hashAuthToken(credentials.magicToken) },
            include: {
              user: {
                include: { organization: { select: { aktivni: true } } },
              },
            },
          })
          if (!token || token.used || token.expiresAt < new Date()) return null
          if (!token.user.aktivni || !token.user.organization.aktivni) return null
          await prisma.magicLinkToken.update({ where: { id: token.id }, data: { used: true } })
          await prisma.user.update({ where: { id: token.user.id }, data: { lastLoginAt: new Date() } })
          return {
            id: token.user.id,
            email: token.user.email,
            jmeno: token.user.jmeno,
            orgId: token.user.orgId,
            role: token.user.role,
            isSuperAdmin: token.user.isSuperAdmin,
          }
        }

        // Normal password login
        if (!credentials?.email || !credentials?.password) return null

        // Brute-force ochrana: per IP i per e-mail (bcrypt cost 12 = ~300 ms CPU na pokus)
        const email = String(credentials.email).trim().toLowerCase()
        const ip = loginClientIp(req)
        if (
          checkRateLimit(`login:ip:${ip}`, 20, 15 * 60_000).limited ||
          checkRateLimit(`login:email:${email}`, 10, 15 * 60_000).limited
        ) {
          throw new Error(LOGIN_RATE_LIMITED)
        }

        // E-mail je unikátní jen per org — heslo rozhodne, který účet to je
        // (stejně jako mobilní login). findFirst by vracel nedeterministický záznam.
        const candidates = await prisma.user.findMany({
          where: { email: credentials.email, aktivni: true, organization: { aktivni: true } },
          include: { organization: { select: { aktivni: true } } },
        })
        let user: (typeof candidates)[number] | null = null
        for (const c of candidates) {
          if (await bcrypt.compare(credentials.password, c.hesloHash)) { user = c; break }
        }
        // Konstantní čas i pro neexistující e-mail (enumerace přes timing)
        if (candidates.length === 0) await bcrypt.compare(credentials.password, DUMMY_HASH)
        if (!user) return null

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        await logAction({
          orgId: user.orgId, userId: user.id, typAkce: 'CREATE', typZaznamu: 'WebLogin',
          zaznamId: user.id, zaznamNazev: `Přihlášení: ${user.email}`, zmeny: { ip },
        })

        return {
          id: user.id,
          email: user.email,
          jmeno: user.jmeno,
          orgId: user.orgId,
          role: user.role,
          isSuperAdmin: user.isSuperAdmin,
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.orgId = user.orgId
        token.role = user.role
        token.jmeno = user.jmeno
        token.isSuperAdmin = user.isSuperAdmin ?? false
        token.isDemo = user.isDemo ?? false
        const org = await prisma.organization.findUnique({ where: { id: user.orgId } })
        token.orgSlug = org?.slug ?? null
        token.plan = org?.plan ?? 'STARTER'
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { permissions: true, sessionVersion: true } })
        token.perms = resolvePermissions(user.role, dbUser?.permissions, token.plan)
        token.sv = dbUser?.sessionVersion ?? 0
        token.permsAt = Date.now()
        return token
      }

      // Periodický refresh role, oprávnění a plánu — bez toho by se změna projevila až po odhlášení.
      // Zároveň jediné místo, kde se JWT session zneplatní: deaktivace uživatele/org,
      // změna hesla (sessionVersion), odebrání superadmina.
      if (!token.perms || !token.permsAt || Date.now() - token.permsAt > PERMS_REFRESH_MS) {
        const snap = await loadPermsSnapshot(token.id)
        if (!isSessionValid(snap, token.sv)) throw new Error(SESSION_INVALID)
        token.role = snap.role as typeof token.role
        token.plan = snap.plan
        token.perms = resolvePermissions(snap.role, snap.permissions, snap.plan)
        token.isSuperAdmin = snap.isSuperAdmin
        token.sv = snap.sessionVersion
        token.permsAt = Date.now()
      }
      return token
    },
    async session({ session, token }) {
      // Populate session from JWT token (the ground truth)
      session.user.id = token.id
      session.user.orgId = token.orgId
      session.user.role = token.role
      session.user.jmeno = token.jmeno
      session.user.orgSlug = token.orgSlug as string
      session.user.plan = token.plan as string
      session.user.isSuperAdmin = token.isSuperAdmin ?? false
      session.user.isDemo = token.isDemo ?? false
      session.user.perms = token.perms ?? resolvePermissions(token.role)

      // SECURITY FIX: When a superadmin is impersonating another org, override all org-scoped
      // fields with the target org's data so every API route sees the correct orgId.
      // Without this, session.user.orgId stays as NANTO's orgId and all data queries
      // return NANTO data regardless of which org is being impersonated.
      if (token.isSuperAdmin) {
        try {
          // Podepsaná cookie (lib/signedCookie.ts) — nepodepsaná/podvržená se ignoruje
          const imp = readImpersonateCookie()
          if (imp) {
            // Verify cookie was set for THIS superadmin (prevents cookie-swap attacks)
            // + impersonovaný uživatel musí patřit cílové org
            if (imp.orgId && imp.impersonatingUserId && imp.superAdminId === token.id) {
              const [targetOrg, targetUser] = await Promise.all([
                prisma.organization.findUnique({
                  where: { id: imp.orgId },
                  select: { id: true, slug: true, plan: true, nazev: true },
                }),
                prisma.user.findFirst({ where: { id: imp.impersonatingUserId, orgId: imp.orgId }, select: { id: true } }),
              ])

              if (targetOrg && targetUser) {
                // Override every org-scoped field so all API routes see the target org
                session.user.id = imp.impersonatingUserId
                session.user.orgId = targetOrg.id
                session.user.orgSlug = targetOrg.slug
                session.user.plan = targetOrg.plan
                session.user.role = 'ADMIN'
                session.user.perms = ROLE_PRESETS.ADMIN
                // Disable superadmin flag during impersonation — the impersonating user
                // should see exactly what a regular org admin sees
                session.user.isSuperAdmin = false
                session.user.impersonating = true
                session.user.impersonatingOrgNazev = targetOrg.nazev
                session.user.impersonatorId = imp.superAdminId
              }
            }
          }
        } catch {
          // cookies() throws outside of a request context (e.g. during build) — safe to ignore
        }
      }

      return session
    },
  },
}
