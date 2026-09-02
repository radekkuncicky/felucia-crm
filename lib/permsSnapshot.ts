import { prisma } from './prisma'

/** Jak často se role/oprávnění/plán obnovují z DB (změna adminem se projeví bez re-loginu) */
export const PERMS_REFRESH_MS = 60_000

// getServerSession se volá vícekrát za request a v RSC se obnovený JWT do cookie nezapíše,
// takže bez cache by po vypršení každé volání šlo do DB. Stejný snapshot používají
// i mobilní bearer tokeny (ty role/oprávnění v sobě nenesou autoritativně).
export type PermsSnapshot = { role: string; plan: string; permissions: unknown; aktivni: boolean; at: number }
const permsCache = new Map<string, PermsSnapshot>()

export async function loadPermsSnapshot(userId: string): Promise<PermsSnapshot | null> {
  const cached = permsCache.get(userId)
  if (cached && Date.now() - cached.at < PERMS_REFRESH_MS) return cached
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, permissions: true, aktivni: true, organization: { select: { plan: true } } },
  })
  if (!dbUser) return null
  const snap = { role: dbUser.role, plan: dbUser.organization.plan, permissions: dbUser.permissions, aktivni: dbUser.aktivni, at: Date.now() }
  permsCache.set(userId, snap)
  return snap
}

/** Zavolat po změně role/oprávnění/aktivity uživatele, aby se projevila hned */
export function invalidatePermsCache(userId: string) {
  permsCache.delete(userId)
}
