import { prisma } from './prisma'

/** Jak často se role/oprávnění/plán obnovují z DB (změna adminem se projeví bez re-loginu) */
export const PERMS_REFRESH_MS = 60_000

// getServerSession se volá vícekrát za request a v RSC se obnovený JWT do cookie nezapíše,
// takže bez cache by po vypršení každé volání šlo do DB. Stejný snapshot používají
// i mobilní bearer tokeny (ty role/oprávnění v sobě nenesou autoritativně).
export type PermsSnapshot = {
  role: string; plan: string; permissions: unknown; aktivni: boolean
  orgAktivni: boolean; isSuperAdmin: boolean; sessionVersion: number; at: number
}
const permsCache = new Map<string, PermsSnapshot>()

export async function loadPermsSnapshot(userId: string): Promise<PermsSnapshot | null> {
  const cached = permsCache.get(userId)
  if (cached && Date.now() - cached.at < PERMS_REFRESH_MS) return cached
  const dbUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      role: true, permissions: true, aktivni: true, isSuperAdmin: true, sessionVersion: true,
      organization: { select: { plan: true, aktivni: true } },
    },
  })
  if (!dbUser) return null
  const snap: PermsSnapshot = {
    role: dbUser.role, plan: dbUser.organization.plan, permissions: dbUser.permissions, aktivni: dbUser.aktivni,
    orgAktivni: dbUser.organization.aktivni, isSuperAdmin: dbUser.isSuperAdmin, sessionVersion: dbUser.sessionVersion,
    at: Date.now(),
  }
  permsCache.set(userId, snap)
  return snap
}

/** Zavolat po změně role/oprávnění/aktivity uživatele, aby se projevila hned */
export function invalidatePermsCache(userId: string) {
  permsCache.delete(userId)
}

/** Session je platná jen pro aktivního uživatele v aktivní org se shodnou verzí session */
export function isSessionValid(snap: PermsSnapshot | null, tokenSessionVersion: number | undefined): snap is PermsSnapshot {
  if (!snap || !snap.aktivni || !snap.orgAktivni) return false
  // Starší tokeny bez verze (vydané před zavedením) se nevyhazují — verze se doplní při refreshi
  if (tokenSessionVersion !== undefined && tokenSessionVersion !== snap.sessionVersion) return false
  return true
}

/** Zneplatní všechny existující session uživatele (web i mobil) — po změně hesla, nuceném odhlášení */
export async function bumpSessionVersion(userId: string): Promise<void> {
  await prisma.user.update({ where: { id: userId }, data: { sessionVersion: { increment: 1 } } })
  invalidatePermsCache(userId)
}
