import type { PrismaClient } from '@prisma/client'
import { createNotification } from '../lib/createNotification'
import { emailKpiTydenniSouhrn, isEmailConfigured, sendEmail } from '../lib/email'
import { kpiPrehled, formatKpi, formatCil, mesicLabel, type KpiVysledek, type Semafor } from '../lib/kpi'

export const TYP_KPI_SOUHRN = 'KPI_TYDENNI_SOUHRN'

const STAV: Record<Semafor, string> = {
  ZELENA: 'splněno', ORANZOVA: 'těsně pod cílem', CERVENA: 'mimo cíl', BEZ_CILE: 'bez cíle', BEZ_DAT: 'chybí data',
}
const BARVA: Record<Semafor, string> = {
  ZELENA: '#22C55E', ORANZOVA: '#F59E0B', CERVENA: '#EF4444', BEZ_CILE: '#94A3B8', BEZ_DAT: '#CBD5E1',
}

/** Text bell notifikace — počty podle semaforu, ať je hned vidět, jestli je co řešit */
export function zpravaSouhrnu(kpi: KpiVysledek[]): string {
  const mimo = kpi.filter(k => k.semafor === 'CERVENA').length
  const tesne = kpi.filter(k => k.semafor === 'ORANZOVA').length
  const casti = [mimo ? `${mimo}× mimo cíl` : null, tesne ? `${tesne}× těsně pod cílem` : null].filter(Boolean)
  const mesic = kpi[0] ? mesicLabel(kpi[0].mesic) : ''
  return `KPI vedení za ${mesic}: ${casti.length ? casti.join(', ') : 'vše v pořádku nebo bez cíle'}`
}

/**
 * Pondělní souhrn KPI (R18): org se zapnutým modulKpi → bell + e-mail všem
 * aktivním uživatelům s rolí JEDNATEL. Proti dvojímu odeslání (restart workeru,
 * ruční spuštění) se přeskočí uživatel, který souhrn dostal za posledních 6 dní.
 * Organizace se hledají owner klientem, KPI se počítají přes orgPrisma(orgId).
 */
export async function sweepKpiTydenniSouhrn(prisma: PrismaClient, now = new Date()): Promise<number> {
  const orgs = await prisma.orgSettings.findMany({
    where: { modulKpi: true, organization: { aktivni: true } },
    select: { orgId: true, organization: { select: { nazev: true, slug: true } } },
  })
  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'felucia.io'
  const pred6dny = new Date(now.getTime() - 6 * 24 * 3600_000)
  let odeslano = 0

  for (const o of orgs) {
    const jednatele = await prisma.user.findMany({
      where: { orgId: o.orgId, role: 'JEDNATEL', aktivni: true },
      select: { id: true, jmeno: true, email: true },
    })
    if (!jednatele.length) continue
    const uzMaji = new Set((await prisma.notification.findMany({
      where: { orgId: o.orgId, typ: TYP_KPI_SOUHRN, createdAt: { gte: pred6dny }, userId: { in: jednatele.map(j => j.id) } },
      select: { userId: true },
    })).map(n => n.userId))
    const prijemci = jednatele.filter(j => !uzMaji.has(j.id))
    if (!prijemci.length) continue

    const kpi = await kpiPrehled(o.orgId, { jenAktivni: true, now })
    if (!kpi.length) continue
    const base = `https://${o.organization.slug}.${rootDomain}`
    const zprava = zpravaSouhrnu(kpi)
    const radky = kpi.map(k => ({
      nazev: k.def.nazev,
      hodnota: k.semafor === 'BEZ_DAT' ? '—' : formatKpi(k.hodnota, k.jednotka),
      cil: formatCil(k.def, k.nastaveni.cil),
      stav: STAV[k.semafor],
      barva: BARVA[k.semafor],
      url: `${base}/kpi/${k.def.kod}`,
    }))

    for (const j of prijemci) {
      await createNotification({ orgId: o.orgId, userId: j.id, typ: TYP_KPI_SOUHRN, zprava, url: '/kpi' })
      if (isEmailConfigured() && j.email) {
        try {
          await sendEmail(j.email, 'KPI vedení — týdenní souhrn', emailKpiTydenniSouhrn({
            jmeno: j.jmeno, orgNazev: o.organization.nazev, radky, url: `${base}/kpi`,
          }))
        } catch (err) {
          console.error('[kpi-souhrn] e-mail selhal', j.id, err)
        }
      }
      odeslano += 1
    }
  }
  return odeslano
}
