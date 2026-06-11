import { Role } from '@prisma/client'
import NextAuth, { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      orgId: string
      role: Role
      jmeno: string
      orgSlug: string
      plan: string
      isSuperAdmin: boolean
      isDemo?: boolean
      impersonating?: boolean        // true when superadmin is viewing another org
      impersonatingOrgNazev?: string // display name of the impersonated org
    } & DefaultSession['user']
  }

  interface User {
    id: string
    orgId: string
    role: Role
    jmeno: string
    isSuperAdmin?: boolean
    isDemo?: boolean
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string
    orgId: string
    role: Role
    jmeno: string
    orgSlug: string | null
    plan: string | null
    isSuperAdmin: boolean
    isDemo?: boolean
  }
}
