import { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'
import { cookies } from 'next/headers'
import { resolvePermissions, ROLE_PRESETS } from './permissions'

export { loadPermsSnapshot, invalidatePermsCache } from './permsSnapshot'
import { loadPermsSnapshot, PERMS_REFRESH_MS } from './permsSnapshot'

export const authOptions: NextAuthOptions = {
  session: {
    strategy: 'jwt',
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
      async authorize(credentials) {
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
            where: { token: credentials.magicToken },
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

        const user = await prisma.user.findFirst({
          where: { email: credentials.email, aktivni: true },
          include: { organization: { select: { aktivni: true } } },
        })

        if (!user || !user.organization.aktivni) return null

        const passwordMatch = await bcrypt.compare(credentials.password, user.hesloHash)
        if (!passwordMatch) return null

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })

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
        const dbUser = await prisma.user.findUnique({ where: { id: user.id }, select: { permissions: true } })
        token.perms = resolvePermissions(user.role, dbUser?.permissions, token.plan)
        token.permsAt = Date.now()
        return token
      }

      // Periodický refresh role, oprávnění a plánu — bez toho by se změna projevila až po odhlášení
      if (!token.perms || !token.permsAt || Date.now() - token.permsAt > PERMS_REFRESH_MS) {
        const snap = await loadPermsSnapshot(token.id)
        if (snap) {
          token.role = snap.role as typeof token.role
          token.plan = snap.plan
          token.perms = resolvePermissions(snap.role, snap.permissions, snap.plan)
        }
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
          const cookieStore = cookies()
          const impCookie = cookieStore.get('sa_impersonate')
          if (impCookie?.value) {
            const imp = JSON.parse(impCookie.value) as {
              superAdminId: string
              superAdminJmeno: string
              orgId: string
              orgNazev: string
              impersonatingUserId: string
            }

            // Verify cookie was set for THIS superadmin (prevents cookie-swap attacks)
            if (imp.orgId && imp.impersonatingUserId && imp.superAdminId === token.id) {
              const targetOrg = await prisma.organization.findUnique({
                where: { id: imp.orgId },
                select: { id: true, slug: true, plan: true, nazev: true },
              })

              if (targetOrg) {
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
