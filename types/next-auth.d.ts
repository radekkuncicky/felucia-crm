import { Role } from '@prisma/client'
import NextAuth, { DefaultSession } from 'next-auth'
import type { Permissions } from '@/lib/permissions'

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
      perms: Permissions
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
    perms?: Permissions
    permsAt?: number
    sv?: number
  }
}
