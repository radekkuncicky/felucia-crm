import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import CalendarClient, { CalendarEvent } from './CalendarClient'

export default async function CalendarPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')

  const orgId = session.user.orgId
  const userId = session.user.id
  const isTechnik = session.user.role === 'TECHNIK'

  const [activities, deals, servisNavstevy, montazZakazky] = await Promise.all([
    prisma.activity.findMany({
      where: { deal: { orgId } },
      include: {
        deal: { include: { client: { select: { jmeno: true, prijmeni: true } } } },
      },
      orderBy: { datum: 'asc' },
    }),
    prisma.deal.findMany({
      where: {
        orgId,
        OR: [
          { terminRealizace: { not: null } },
          { terminPrevzeti: { not: null } },
          { splatnostZalohy: { not: null } },
        ],
      },
      include: { client: { select: { jmeno: true, prijmeni: true } } },
    }),
    prisma.servisniZakazka.findMany({
      where: { orgId, stav: { in: ['NAPLANOVANA', 'PROBIHA'] }, planovanyTermin: { not: null } },
      include: {
        kontrakt: { select: { nazev: true, klient: { select: { jmeno: true, prijmeni: true } } } },
        klient: { select: { jmeno: true, prijmeni: true } },
        zarizeni: { select: { nazev: true } },
        technik: { select: { jmeno: true } },
      },
    }),
    prisma.zakazka.findMany({
      where: {
        orgId,
        montazOd: { not: null },
        ...(isTechnik ? { techniciRel: { some: { technikId: userId } } } : {}),
      },
      include: {
        klient: { select: { jmeno: true, prijmeni: true } },
        techniciRel: { include: { technik: { select: { jmeno: true } } } },
      },
    }),
  ])

  const events: CalendarEvent[] = []

  const typMap: Record<string, CalendarEvent['kind']> = {
    HOVOR: 'HOVOR', EMAIL: 'EMAIL', SCHUZKA: 'SCHUZKA', UKOL: 'UKOL', POZNAMKA: 'POZNAMKA',
  }

  for (const a of activities) {
    const kind = typMap[a.typ] ?? 'POZNAMKA'
    const klient = `${a.deal.client.jmeno} ${a.deal.client.prijmeni}`
    events.push({
      id: `act-${a.id}`,
      kind,
      date: a.datum.toISOString().split('T')[0],
      time: a.cas ?? undefined,
      trvaniMin: a.trvaniMin ?? undefined,
      title: `${typMap[a.typ] ?? a.typ} - ${a.deal.client.jmeno} ${a.deal.client.prijmeni}`,
      subtitle: klient,
      href: `/deals/${a.deal.id}?tab=aktivity`,
      done: a.stav === 'DOKONCENA',
      zruseno: a.stav === 'ZRUSENA',
    })
  }

  for (const d of deals) {
    const klient = `${d.client.jmeno} ${d.client.prijmeni}`
    const predmet = d.predmet ?? d.kod ?? 'Případ'
    if (d.terminRealizace) {
      events.push({
        id: `deal-rea-${d.id}`,
        kind: 'REALIZACE',
        date: d.terminRealizace.toISOString().split('T')[0],
        title: `Realizace: ${predmet}`,
        subtitle: klient,
        href: `/deals/${d.id}`,
      })
    }
    if (d.terminPrevzeti) {
      events.push({
        id: `deal-pre-${d.id}`,
        kind: 'PREVZETI',
        date: d.terminPrevzeti.toISOString().split('T')[0],
        title: `Převzetí: ${predmet}`,
        subtitle: klient,
        href: `/deals/${d.id}`,
      })
    }
    if (d.splatnostZalohy) {
      events.push({
        id: `deal-zal-${d.id}`,
        kind: 'ZALOHA',
        date: d.splatnostZalohy.toISOString().split('T')[0],
        title: `Záloha: ${predmet}`,
        subtitle: klient,
        href: `/deals/${d.id}`,
      })
    }
  }

  for (const n of servisNavstevy) {
    if (!n.planovanyTermin) continue
    const klientObj = n.kontrakt?.klient ?? n.klient
    const klient = klientObj ? `${klientObj.jmeno} ${klientObj.prijmeni}` : ''
    const predmet = n.zarizeni?.nazev ?? n.kontrakt?.nazev ?? 'Servis'
    const subtitle = n.technik ? `${klient}${klient ? ' · ' : ''}${n.technik.jmeno}` : klient
    events.push({
      id: `servis-${n.id}`,
      kind: 'SERVIS',
      date: n.planovanyTermin.toISOString().split('T')[0],
      time: `${String(n.planovanyTermin.getHours()).padStart(2, '0')}:${String(n.planovanyTermin.getMinutes()).padStart(2, '0')}`,
      title: `Servis: ${predmet}`,
      subtitle,
      href: `/servis/zakazky/${n.id}`,
    })
  }

  for (const z of montazZakazky) {
    if (!z.montazOd) continue
    const klient = `${z.klient.jmeno} ${z.klient.prijmeni}`
    const techniciNames = z.techniciRel.map(t => t.technik.jmeno)
    const montazOd = z.montazOd
    const montazDo = z.montazDo

    let trvaniMin: number | undefined
    if (montazDo) {
      trvaniMin = Math.round((montazDo.getTime() - montazOd.getTime()) / 60000)
    }

    events.push({
      id: `montaz-${z.id}`,
      kind: 'REALIZACE',
      date: montazOd.toISOString().split('T')[0],
      time: `${String(montazOd.getHours()).padStart(2, '0')}:${String(montazOd.getMinutes()).padStart(2, '0')}`,
      trvaniMin,
      title: `Montáž: ${klient}`,
      subtitle: techniciNames.length > 0 ? `${z.cislo} · ${techniciNames.join(', ')}` : z.cislo,
      href: `/zakazky/${z.id}`,
      technici: techniciNames,
    })
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kalendář</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Aktivity, termíny realizací, zálohy a servisní návštěvy</p>
      </div>
      <CalendarClient events={events} canDispatch={!isTechnik} />
    </div>
  )
}
