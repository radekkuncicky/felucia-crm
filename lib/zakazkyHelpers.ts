import { prisma } from './prisma'
import { orgPrisma } from './orgPrisma'
import { dealScopeWhere, servisScopeWhere, zakazkyScopeWhere, resolvePermissions, type Permissions, type PermissionKey } from './permissions'

export async function generatePredavakCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `PP-${year}-`
  const last = await prisma.predavak.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
  })
  const lastNum = last ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

export async function generateVyuctovaniCislo(orgId: string): Promise<string> {
  const year = new Date().getFullYear().toString().slice(2)
  const prefix = `VYU-${year}-`
  const last = await prisma.vyuctovani.findFirst({
    where: { orgId, cislo: { startsWith: prefix } },
    orderBy: { cislo: 'desc' },
  })
  const lastNum = last ? parseInt(last.cislo.slice(prefix.length), 10) : 0
  return `${prefix}${String(lastNum + 1).padStart(3, '0')}`
}

/**
 * Smí uživatel na zakázku podle rozsahu oprávnění (`perms.zakazky`)?
 * VSE → stačí existence v org, PRIRAZENE → technik / vedoucí / autor OP, ZADNE → nikdy.
 */
export async function canAccessZakazka(
  user: { id: string; orgId: string },
  perms: Permissions,
  zakazkaId: string,
): Promise<boolean> {
  const scope = zakazkyScopeWhere(perms, user.id)
  if (scope === null) return false
  const z = await orgPrisma(user.orgId).zakazka.findFirst({
    where: { id: zakazkaId, orgId: user.orgId, ...scope },
    select: { id: true },
  })
  return !!z
}

/**
 * Předávák smí upravovat jeho technik, nebo kdokoli, kdo protokoly schvaluje (manažer).
 * Ostatní s přístupem k zakázce ho jen vidí.
 */
export function canEditPredavak(
  user: { id: string },
  perms: Permissions,
  predavak: { technikId: string },
): boolean {
  return predavak.technikId === user.id || perms.zakazkySchvalovani
}

/** Předávák vidí jeho technik, nebo kdokoli, kdo má jeho zakázku v rozsahu */
export async function canAccessPredavak(
  user: { id: string; orgId: string },
  perms: Permissions,
  predavak: { technikId: string; zakazkaId: string },
): Promise<boolean> {
  if (predavak.technikId === user.id) return true
  return canAccessZakazka(user, perms, predavak.zakazkaId)
}

/** Má daný (jiný) uživatel org efektivní boolean oprávnění? Pro validaci vstupů typu vedoucíId. */
export async function userHasPerm(orgId: string, userId: string, key: PermissionKey): Promise<boolean> {
  const u = await orgPrisma(orgId).user.findFirst({
    where: { id: userId, orgId, aktivni: true },
    select: { role: true, permissions: true, organization: { select: { plan: true } } },
  })
  if (!u) return false
  return resolvePermissions(u.role, u.permissions, u.organization.plan)[key] === true
}

/** Aktivní uživatelé org s daným oprávněním (např. příjemci notifikací) */
export async function listUsersWithPerm(orgId: string, key: PermissionKey) {
  return listUsersWithPermValue(orgId, key, true)
}

/** Aktivní uživatelé org, jejichž efektivní oprávnění `key` má hodnotu `value` (bool i enum, např. sklad === 'PLNY') */
export async function listUsersWithPermValue(orgId: string, key: PermissionKey, value: boolean | string) {
  const users = await orgPrisma(orgId).user.findMany({
    where: { orgId, aktivni: true },
    select: { id: true, jmeno: true, role: true, permissions: true, organization: { select: { plan: true } } },
    orderBy: { jmeno: 'asc' },
  })
  return users
    .filter(u => resolvePermissions(u.role, u.permissions, u.organization.plan)[key] === value)
    .map(u => ({ id: u.id, jmeno: u.jmeno }))
}

/** Uživatelé org, kteří mohou být vedoucím zakázky (mají `zakazkySchvalovani`) */
export function listVedouciKandidati(orgId: string) {
  return listUsersWithPerm(orgId, 'zakazkySchvalovani')
}

/**
 * Smí uživatel pracovat s OP? Rozsah podle `obchod`/`obchodCiziOP`
 * (dealScopeWhere) — stejná logika jako v /api/deals/[id]; používají ji
 * všechny pod-routes OP (nabídky, položky, aktivity, fotky, duplikace…),
 * které dřív kontrolovaly jen přihlášení.
 */
export async function canAccessDeal(
  user: { id: string; orgId: string },
  perms: Permissions,
  dealId: string,
): Promise<boolean> {
  const scope = dealScopeWhere(perms, user.id)
  if (scope === null) return false
  const d = await orgPrisma(user.orgId).deal.findFirst({
    where: { id: dealId, orgId: user.orgId, ...scope },
    select: { id: true },
  })
  return !!d
}

/** Totéž přes ID nabídky (routes /api/quotes/[id]/**) */
export async function canAccessQuote(
  user: { id: string; orgId: string },
  perms: Permissions,
  quoteId: string,
): Promise<boolean> {
  const scope = dealScopeWhere(perms, user.id)
  if (scope === null) return false
  const q = await orgPrisma(user.orgId).quote.findFirst({
    where: { id: quoteId, deal: { orgId: user.orgId, ...scope } },
    select: { id: true },
  })
  return !!q
}

/** Servisní zakázka v rozsahu `servis` (VSE / jen přiřazené) — pro web routes */
export async function canAccessServisniZakazkaWeb(
  user: { id: string; orgId: string },
  perms: Permissions,
  zakazkaId: string,
): Promise<boolean> {
  const scope = servisScopeWhere(perms, user.id)
  if (scope === null) return false
  const z = await orgPrisma(user.orgId).servisniZakazka.findFirst({
    where: { id: zakazkaId, orgId: user.orgId, ...scope },
    select: { id: true },
  })
  return !!z
}
