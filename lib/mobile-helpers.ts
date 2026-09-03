import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getMobileSession } from '@/lib/mobile-auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { getPerms, zakazkyScopeWhere, servisScopeWhere, type Permissions, type RoleName } from '@/lib/permissions'

export type MobileSession = {
  user: {
    id: string
    orgId: string
    role: RoleName
    plan: string
    /** efektivní oprávnění (preset role + přepisy), pro getPerms() */
    perms: Permissions
    isSuperAdmin?: boolean
  }
}

/**
 * Bearer token first, then cookie session fallback.
 * Mobilní token nese jen userId/orgId — role, plán i oprávnění řeší getMobileSession z DB
 * (cache 60 s sdílená s webovým JWT), aby změna role v nastavení platila i pro appku.
 */
export async function getMobileOrWebSession(req: Request): Promise<MobileSession | null> {
  const mobile = await getMobileSession(req)
  if (mobile) {
    return {
      user: {
        id: mobile.user.id,
        orgId: mobile.user.orgId,
        role: mobile.user.role,
        plan: mobile.user.plan,
        perms: mobile.user.perms,
      },
    }
  }
  const web = await getServerSession(authOptions)
  if (!web) return null
  return {
    user: {
      id: web.user.id,
      orgId: web.user.orgId,
      role: web.user.role as RoleName,
      plan: web.user.plan ?? 'STARTER',
      // getPerms: superadmin → vše, chybějící perms (starý JWT, testy) → preset role
      perms: getPerms(web.user),
      isSuperAdmin: web.user.isSuperAdmin,
    },
  }
}

function permsOf(session: MobileSession): Permissions {
  return getPerms(session.user)
}

/** Technický modul (Felucia Tech): kdokoli, kdo vidí aspoň přiřazené zakázky. Returns 401/403 response or null if ok */
export function requireTechnikOrAdmin(session: MobileSession | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (permsOf(session).zakazky === 'ZADNE' && permsOf(session).servis === 'ZADNY') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/** Obchodní modul (Felucia Sales): vyžaduje oprávnění `obchod` */
export function requireObchodnikOrAdmin(session: MobileSession | null): NextResponse | null {
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!permsOf(session).obchod) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/** Zakázka je v rozsahu uživatele (VSE = celá org, PRIRAZENE = technik/vedoucí/obchodník OP) */
export async function canAccessZakazka(
  session: MobileSession,
  zakazkaId: string,
): Promise<boolean> {
  const scope = zakazkyScopeWhere(permsOf(session), session.user.id)
  if (scope === null) return false
  const z = await prisma.zakazka.findFirst({
    where: { id: zakazkaId, orgId: session.user.orgId, ...scope },
    select: { id: true },
  })
  return !!z
}

/** Předávák: vlastní, nebo je jeho zakázka v rozsahu uživatele */
export async function canAccessPredavak(
  session: MobileSession,
  predavakId: string,
): Promise<boolean> {
  const p = await prisma.predavak.findFirst({
    where: { id: predavakId, orgId: session.user.orgId },
    select: { technikId: true, zakazkaId: true },
  })
  if (!p) return false
  if (p.technikId === session.user.id) return true
  return canAccessZakazka(session, p.zakazkaId)
}

/** Servisní zakázka je v rozsahu uživatele (VSE = celá org, VLASTNI = jen přiřazené) */
export async function canAccessServisniZakazka(
  session: MobileSession,
  zakazkaId: string,
): Promise<boolean> {
  const scope = servisScopeWhere(permsOf(session), session.user.id)
  if (scope === null) return false
  const z = await prisma.servisniZakazka.findFirst({
    where: { id: zakazkaId, orgId: session.user.orgId, ...scope },
    select: { id: true },
  })
  return !!z
}

/** Composed address string from client fields */
export function klientAdresa(klient: { ulice?: string | null; mesto?: string | null; psc?: string | null }): string {
  return [klient.ulice, [klient.mesto, klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

/**
 * Web uploads store photos as inline `data:` URIs; native app uploads store relative
 * `/uploads/...` paths. Only relative paths need the origin prepended — `http(s):` and
 * `data:` URIs are already self-contained and must pass through unchanged.
 */
export function toAbsoluteUrl(url: string | null | undefined, origin: string): string | null {
  if (!url) return null
  if (url.startsWith('http') || url.startsWith('data:')) return url
  return `${origin}${url}`
}
