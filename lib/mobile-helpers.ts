import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export type MobileSession = {
  user: {
    id: string
    orgId: string
    role: 'ADMIN' | 'OBCHODNIK' | 'TECHNIK'
    plan: string
  }
}

/** Bearer token first, then cookie session fallback */
export async function getMobileOrWebSession(req: Request): Promise<MobileSession | null> {
  const mobile = await getMobileSession(req)
  if (mobile) return mobile as MobileSession
  const web = await getServerSession(authOptions)
  if (!web) return null
  return {
    user: {
      id: web.user.id,
      orgId: web.user.orgId,
      role: web.user.role as MobileSession['user']['role'],
      plan: web.user.plan ?? 'STARTER',
    },
  }
}

/** Returns 401/403 response or null if ok */
export function requireTechnikOrAdmin(session: MobileSession | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'TECHNIK' && session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/** Checks technik is assigned to the order (or is ADMIN of same org) */
export async function canAccessZakazka(
  session: MobileSession,
  zakazkaId: string,
): Promise<boolean> {
  if (session.user.role === 'ADMIN') {
    const z = await prisma.zakazka.findFirst({ where: { id: zakazkaId, orgId: session.user.orgId } })
    return !!z
  }
  const rel = await prisma.technikZakazka.findFirst({
    where: { technikId: session.user.id, zakazkaId },
  })
  return !!rel
}

/** Composed address string from client fields */
export function klientAdresa(klient: { ulice?: string | null; mesto?: string | null; psc?: string | null }): string {
  return [klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}
