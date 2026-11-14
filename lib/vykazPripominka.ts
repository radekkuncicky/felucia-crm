/**
 * Večerní připomínka zápisu výkazu práce: technik byl dnes na montáži / servisu
 * (stejná logika jako „Dnes“ na nástěnce — lib/dnesniVyjezdy.ts) a k té zakázce
 * dnes nic nezapsal → push v 18:00 (worker) a blok „Dnes nezapsáno“ v appce.
 *
 * Připomínka chodí jen technikům, kterým firma nastavila sazbu (= výkaz u nich používá),
 * a kteří si ji v appce nevypnuli (User.vykazPripominka).
 */
import { orgPrisma, type OrgPrismaClient } from './orgPrisma'
import { prisma } from './prisma'
import { resolvePermissions, type Permissions } from './permissions'
import { dnesniVyjezdy, dnesPraha, type Vyjezd } from './dnesniVyjezdy'
import { getOrgSettings } from './orgSettings'
import { sendPushToUsers } from './push'

export type Nezapsany = Pick<Vyjezd, 'typ' | 'id' | 'cislo' | 'titulek' | 'klient'>

/** Dnešní výjezdy technika, ke kterým dnes ještě nemá žádný záznam výkazu */
export async function nezapsaneDnes(
  db: OrgPrismaClient,
  opts: { orgId: string; userId: string; perms: Permissions; plan?: string | null; modulServis?: boolean; now?: Date },
): Promise<Nezapsany[]> {
  const now = opts.now ?? new Date()
  const vyjezdy = await dnesniVyjezdy(db, { ...opts, now })
  if (vyjezdy.length === 0) return []
  const dnes = new Date(`${dnesPraha(now)}T00:00:00.000Z`) // VykazPrace.datum je @db.Date
  const zapsane = await db.vykazPrace.findMany({
    where: { orgId: opts.orgId, userId: opts.userId, datum: dnes },
    select: { zakazkaId: true, servisniZakazkaId: true },
  })
  const ids = new Set(zapsane.flatMap(z => [z.zakazkaId, z.servisniZakazkaId]).filter(Boolean))
  return vyjezdy
    .filter(v => !ids.has(v.id))
    .map(v => ({ typ: v.typ, id: v.id, cislo: v.cislo, titulek: v.titulek, klient: v.klient }))
}

/** Text pushe: „26-201 Novák, servis Dvořák“ (max 3 + „a další“) */
export function textPripominky(n: Nezapsany[]): string {
  const popis = (v: Nezapsany) => v.typ === 'servis'
    ? `servis ${v.klient || v.cislo}`.trim()
    : [v.cislo, v.klient.split(' ').pop()].filter(Boolean).join(' ')
  const prvni = n.slice(0, 3).map(popis).join(', ')
  return `${prvni}${n.length > 3 ? ` a další (${n.length - 3})` : ''} — zapiš hodiny a km, dokud to máš v hlavě.`
}

/** Worker 18:00 Praha: rozešle připomínky. Vrací počet technik, kterým šel push. */
export async function sweepVykazPripominky(now = new Date()): Promise<number> {
  // Worker jede jako owner (bare prisma) na výběr příjemců; data technika čte přes orgPrisma (RLS)
  const technici = await prisma.user.findMany({
    where: {
      aktivni: true,
      vykazPripominka: true,
      vykazPouzivat: true,
      pushToken: { not: null },
      role: { in: ['TECHNIK', 'HLAVNI_TECHNIK'] },
      OR: [{ sazbaHodina: { not: null } }, { sazbaKm: { not: null } }],
    },
    select: { id: true, orgId: true, role: true, permissions: true, organization: { select: { plan: true } } },
  })

  let odeslano = 0
  const settingsCache = new Map<string, boolean>()
  for (const t of technici) {
    try {
      if (!settingsCache.has(t.orgId)) settingsCache.set(t.orgId, (await getOrgSettings(t.orgId)).modulServis)
      const plan = t.organization.plan
      const n = await nezapsaneDnes(orgPrisma(t.orgId), {
        orgId: t.orgId, userId: t.id, plan, modulServis: settingsCache.get(t.orgId),
        perms: resolvePermissions(t.role, t.permissions, plan), now,
      })
      if (n.length === 0) continue
      await sendPushToUsers(t.orgId, [t.id], {
        title: 'Zapiš si dnešní práci',
        body: textPripominky(n),
        data: { type: 'vykaz' },
      })
      odeslano++
    } catch (e) {
      console.error('[vykaz-pripominka]', t.id, e)
    }
  }
  return odeslano
}
