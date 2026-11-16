import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { dealScopeWhere, getPerms } from '@/lib/permissions'
import { getPlanLimits } from '@/lib/planLimits'
import { orgPrisma } from '@/lib/orgPrisma'
import { notFound } from 'next/navigation'
import { getOrgSettings } from '@/lib/orgSettings'
import { DIKTAT_WHERE, NEZPRACOVANY_WHERE, diktatScope } from '@/lib/diktat'
import { navrhniCil } from '@/lib/diktatNavrh'
import DiktatyClient, { type DiktatRadek } from './DiktatyClient'

/**
 * Inbox „Diktáty ke zpracování“ — diktáty bez OP/leadu z appky Sales i webu.
 * Obchodník vidí svoje, vedení (obchodCiziOP) všechny. U každého návrh, kam
 * patří (telefon / jméno → OP, lead), ruční připojení, Dáša, vyřízeno.
 */
export default async function DiktatyPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()
  const perms = getPerms(session.user)
  if (!perms.obchod) notFound()
  const { orgId, id: userId } = session.user
  const db = orgPrisma(orgId)
  const scope = diktatScope(perms, userId)
  const plan = session.user.plan ?? 'STARTER'
  const settings = await getOrgSettings(orgId)
  const maLeady = plan !== 'STARTER' && settings.modulLeady !== false

  const select = { id: true, popis: true, vytvoreno: true, mobileId: true, user: { select: { id: true, jmeno: true } } } as const
  const mesicZpet = new Date(Date.now() - 30 * 24 * 3600 * 1000)
  const [nezpracovane, vyrizene] = await Promise.all([
    db.activity.findMany({ where: { orgId, ...NEZPRACOVANY_WHERE, ...scope }, select, orderBy: { vytvoreno: 'desc' }, take: 100 }),
    db.activity.findMany({ where: { orgId, ...DIKTAT_WHERE, stav: 'DOKONCENA', vytvoreno: { gte: mesicZpet }, ...scope }, select, orderBy: { vytvoreno: 'desc' }, take: 30 }),
  ])

  const dealScope = dealScopeWhere(perms, userId) ?? { id: '__none__' }
  const navrhy = await Promise.all(nezpracovane.map(d => navrhniCil(db, orgId, d.popis ?? '', dealScope, maLeady)))

  const radek = (d: (typeof nezpracovane)[number]): Omit<DiktatRadek, 'navrhy'> => ({
    id: d.id,
    text: d.popis ?? '',
    vytvoreno: d.vytvoreno.toISOString(),
    autor: d.user?.jmeno ?? null,
    cizi: !!d.user && d.user.id !== userId,
    zAppky: !!d.mobileId,
  })

  return (
    <DiktatyClient
      nezpracovane={nezpracovane.map((d, i) => ({ ...radek(d), navrhy: navrhy[i] }))}
      vyrizene={vyrizene.map(d => ({ ...radek(d), navrhy: [] }))}
      vidiVse={perms.obchodCiziOP}
      maLeady={maLeady}
      maDasu={getPlanLimits(plan).canUseAI && settings.modulDasa}
    />
  )
}
