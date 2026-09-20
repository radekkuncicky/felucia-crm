import { jwtVerify, type JWTPayload } from 'jose'
import { NextRequest } from 'next/server'
import { isSessionValid, loadPermsSnapshot } from './permsSnapshot'
import { resolvePermissions, type Permissions, type RoleName } from './permissions'

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!)

interface MobileTokenPayload extends JWTPayload {
  userId: string
  orgId: string
  orgSlug: string
  role: string
  plan: string
  /** User.sessionVersion v době vydání — neshoda = token zneplatněn (změna hesla) */
  sv?: number
}

export type MobileSessionUser = {
  id: string
  orgId: string
  orgSlug: string
  role: RoleName
  plan: string
  perms: Permissions
  jmeno: string
  email: string
  isSuperAdmin: boolean
}

/**
 * Session z mobilního bearer tokenu. Role/plán/oprávnění se berou z DB (cache 60 s),
 * ne z tokenu — změna adminem nebo deaktivace se tak projeví i bez re-loginu.
 */
export async function getMobileSession(req: NextRequest | Request): Promise<{ user: MobileSessionUser } | null> {
  const auth = req.headers.get('Authorization')
  if (!auth?.startsWith('Bearer ')) return null

  const token = auth.slice(7)
  try {
    const { payload } = await jwtVerify(token, secret)
    const p = payload as MobileTokenPayload
    if (!p.userId || !p.orgId) return null
    const snap = await loadPermsSnapshot(p.userId)
    if (!isSessionValid(snap, p.sv)) return null
    return {
      user: {
        id: p.userId,
        orgId: p.orgId,
        orgSlug: p.orgSlug ?? '',
        role: snap.role as RoleName,
        plan: snap.plan,
        perms: resolvePermissions(snap.role, snap.permissions, snap.plan),
        jmeno: '',
        email: '',
        isSuperAdmin: false,
      },
    }
  } catch {
    return null
  }
}

export { secret }
