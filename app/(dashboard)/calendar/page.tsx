import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CalendarClient, { CalendarEvent, KdykolivZakazka } from './CalendarClient'
import { getPerms, dealScopeWhere, servisScopeWhere, zakazkyScopeWhere } from '@/lib/permissions'
import {
  AKTIVITA_DOPLNEK, DOPLNEK, SERVIS_DOPLNEK, calendarTitle, dateRange, fmtTime, klientJmeno, servisTechnologie, technologieLabel, utcDateStr, zarizeniTech,
} from '@/lib/calendarEvents'
import { leadJmeno } from '@/lib/activities'

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  const userId = session.user.id
  const perms = getPerms(session.user)
  // Každý druh události jen v rozsahu oprávnění uživatele
  const dealScope = dealScopeWhere(perms, userId)
  const servisScope = servisScopeWhere(perms, userId)
  const zakazkyScope = zakazkyScopeWhere(perms, userId)

  const [activities, leadActivities, deals, servisNavstevy, montazZakazky, kdykolivZakazky] = await Promise.all([
    !dealScope ? [] : prisma.activity.findMany({
      where: { deal: { orgId, ...dealScope } },
      include: {
        deal: { include: { client: { select: { jmeno: true, prijmeni: true, typKlienta: true } } } },
      },
      orderBy: { datum: 'asc' },
    }),
    // Hovory/e-maily na leadech — leady vidí každý s obchodem (STANDARD+)
    !perms.obchod || session.user.plan === 'STARTER' ? [] : prisma.activity.findMany({
      where: { orgId, leadId: { not: null } },
      include: { lead: { select: { id: true, jmeno: true, firma: true } } },
      orderBy: { datum: 'asc' },
    }),
    !dealScope ? [] : prisma.deal.findMany({
      where: {
        orgId,
        ...dealScope,
        OR: [
          { terminRealizace: { not: null } },
          { terminPrevzeti: { not: null } },
          { splatnostZalohy: { not: null } },
        ],
      },
      include: { client: { select: { jmeno: true, prijmeni: true, typKlienta: true } } },
    }),
    !servisScope ? [] : prisma.servisniZakazka.findMany({
      where: { orgId, ...servisScope, stav: { in: ['NAPLANOVANA', 'PROBIHA'] }, planovanyTermin: { not: null } },
      include: {
        kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true, typKlienta: true } }, zarizeni: { select: { nazev: true, typ: true } } } },
        klient: { select: { jmeno: true, prijmeni: true, typKlienta: true } },
        zarizeni: { select: { nazev: true, typ: true } },
        technik: { select: { jmeno: true } },
      },
    }),
    !zakazkyScope ? [] : prisma.zakazka.findMany({
      where: {
        orgId,
        OR: [
          { montazOd: { not: null } },
          { etapy: { some: { montazOd: { not: null } } } },
        ],
        AND: [zakazkyScope],
      },
      include: {
        klient: { select: { jmeno: true, prijmeni: true, typKlienta: true } },
        techniciRel: { include: { technik: { select: { jmeno: true } } } },
        etapy: { where: { montazOd: { not: null } }, orderBy: { cislo: 'asc' } },
      },
    }),
    // Pool „Kdykoliv" — nezaplánované zakázky k výplni volných dnů (jen pro dispečera)
    !zakazkyScope || !perms.zakazkyEdit ? [] : prisma.zakazka.findMany({
      where: {
        orgId,
        kdykoliv: true,
        montazOd: null,
        stav: { notIn: ['PREDANA', 'VYUCTOVANA', 'HOTOVO'] },
        etapy: { none: { montazOd: { not: null } } },
        AND: [zakazkyScope],
      },
      select: {
        id: true, cislo: true, nazev: true, technologie: true,
        klient: { select: { jmeno: true, prijmeni: true, typKlienta: true } },
        techniciRel: { select: { technik: { select: { jmeno: true } } } },
      },
      orderBy: { vytvoreno: 'asc' },
    }),
  ])

  const events: CalendarEvent[] = []

  const typMap: Record<string, CalendarEvent['kind']> = {
    HOVOR: 'HOVOR', EMAIL: 'EMAIL', SCHUZKA: 'SCHUZKA', UKOL: 'UKOL', POZNAMKA: 'POZNAMKA',
  }

  for (const a of activities) {
    if (!a.deal) continue
    const kind = typMap[a.typ] ?? 'POZNAMKA'
    const klient = klientJmeno(a.deal.client)
    const tech = technologieLabel(a.deal.technologie)
    events.push({
      id: `act-${a.id}`,
      kind,
      date: utcDateStr(a.datum),
      time: a.cas ?? undefined,
      trvaniMin: a.trvaniMin ?? undefined,
      title: calendarTitle(klient, tech, AKTIVITA_DOPLNEK[a.typ] ?? a.typ.toLowerCase()),
      klient,
      tech: a.deal.technologie ?? undefined,
      subtitle: a.deal.predmet ?? a.deal.kod ?? '',
      href: `/deals/${a.deal.id}?tab=aktivity`,
      done: a.stav === 'DOKONCENA',
      zruseno: a.stav === 'ZRUSENA',
    })
  }

  for (const a of leadActivities) {
    if (!a.lead) continue
    events.push({
      id: `act-${a.id}`,
      kind: typMap[a.typ] ?? 'POZNAMKA',
      date: utcDateStr(a.datum),
      time: a.cas ?? undefined,
      trvaniMin: a.trvaniMin ?? undefined,
      title: calendarTitle(leadJmeno(a.lead), 'Lead', AKTIVITA_DOPLNEK[a.typ] ?? a.typ.toLowerCase()),
      klient: leadJmeno(a.lead),
      subtitle: a.popis ?? '',
      href: `/leady/${a.lead.id}`,
      done: a.stav === 'DOKONCENA',
      zruseno: a.stav === 'ZRUSENA',
    })
  }

  for (const d of deals) {
    const klient = klientJmeno(d.client)
    const tech = technologieLabel(d.technologie)
    const predmet = d.predmet ?? d.kod ?? ''
    if (d.terminRealizace) {
      // Realizace běží od termínu realizace do termínu převzetí (pokud je pozdější) → souvislý pruh od–do
      const konec = d.terminPrevzeti && d.terminPrevzeti > d.terminRealizace ? d.terminPrevzeti : null
      events.push({
        id: `deal-rea-${d.id}`,
        kind: 'REALIZACE',
        ...dateRange(d.terminRealizace, konec),
        title: calendarTitle(klient, tech, DOPLNEK.REALIZACE),
        klient,
        tech: d.technologie ?? undefined,
        subtitle: predmet,
        href: `/deals/${d.id}`,
      })
    }
    if (d.terminPrevzeti) {
      events.push({
        id: `deal-pre-${d.id}`,
        kind: 'PREVZETI',
        date: utcDateStr(d.terminPrevzeti),
        title: calendarTitle(klient, tech, DOPLNEK.PREVZETI),
        klient,
        tech: d.technologie ?? undefined,
        subtitle: predmet,
        href: `/deals/${d.id}`,
      })
    }
    if (d.splatnostZalohy) {
      events.push({
        id: `deal-zal-${d.id}`,
        kind: 'ZALOHA',
        date: utcDateStr(d.splatnostZalohy),
        title: calendarTitle(klient, tech, DOPLNEK.ZALOHA),
        klient,
        tech: d.technologie ?? undefined,
        subtitle: predmet,
        href: `/deals/${d.id}`,
      })
    }
  }

  for (const n of servisNavstevy) {
    if (!n.planovanyTermin) continue
    const klient = klientJmeno(n.kontrakt?.klient ?? n.klient)
    const tech = servisTechnologie(n.zarizeni ?? n.kontrakt?.zarizeni)
    const subtitle = [n.cislo, n.kontrakt?.nazev, n.technik?.jmeno].filter(Boolean).join(' · ')
    events.push({
      id: `servis-${n.id}`,
      kind: 'SERVIS',
      date: utcDateStr(n.planovanyTermin),
      time: fmtTime(n.planovanyTermin),
      title: calendarTitle(klient, tech, SERVIS_DOPLNEK[n.typ] ?? DOPLNEK.SERVIS),
      klient,
      tech: zarizeniTech(n.zarizeni ?? n.kontrakt?.zarizeni),
      subtitle,
      href: `/servis/zakazky/${n.id}`,
    })
  }

  for (const z of montazZakazky) {
    const klient = klientJmeno(z.klient)
    const tech = technologieLabel(z.technologie) || z.nazev
    const techniciNames = z.techniciRel.map(t => t.technik.jmeno)
    const subtitle = techniciNames.length > 0 ? `${z.cislo} · ${techniciNames.join(', ')}` : z.cislo

    // Zakázka s více etapami → každá etapa má vlastní termín; jinak hlavní termín zakázky
    const etapy = z.etapy.filter(e => e.montazOd)
    if (etapy.length >= 2 || (etapy.length === 1 && !z.montazOd)) {
      for (const e of etapy) {
        const etapaLabel = e.nazev ? `${e.cislo}. etapa – ${e.nazev}` : `${e.cislo}. etapa`
        events.push({
          id: `montaz-${z.id}-etapa-${e.id}`,
          kind: 'REALIZACE',
          ...dateRange(e.montazOd!, e.montazDo),
          title: calendarTitle(klient, tech, `${DOPLNEK.MONTAZ}, ${etapaLabel}`),
          short: `${klient} (${e.cislo}. et.)`,
          klient: `${klient} (${e.cislo}. et.)`,
          tech: z.technologie ?? undefined,
          move: { zakazkaId: z.id, etapaId: e.id },
          subtitle,
          href: `/zakazky/${z.id}`,
          technici: techniciNames,
          kdykoliv: z.kdykoliv,
        })
      }
      continue
    }
    if (!z.montazOd) continue
    events.push({
      id: `montaz-${z.id}`,
      kind: 'REALIZACE',
      ...dateRange(z.montazOd, z.montazDo),
      title: calendarTitle(klient, tech, DOPLNEK.MONTAZ),
      short: klient,
      klient,
      tech: z.technologie ?? undefined,
      move: { zakazkaId: z.id },
      subtitle,
      href: `/zakazky/${z.id}`,
      technici: techniciNames,
      kdykoliv: z.kdykoliv,
    })
  }

  const kdykolivPool: KdykolivZakazka[] = kdykolivZakazky.map(z => ({
    id: z.id,
    cislo: z.cislo,
    nazev: z.nazev,
    klient: klientJmeno(z.klient),
    technologie: technologieLabel(z.technologie),
    technici: z.techniciRel.map(t => t.technik.jmeno),
    href: `/zakazky/${z.id}`,
  }))

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kalendář</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Aktivity, termíny realizací a montáží, zálohy a servisní návštěvy</p>
      </div>
      <CalendarClient events={events} canDispatch={perms.zakazkyEdit} kdykolivPool={kdykolivPool} />
    </div>
  )
}
