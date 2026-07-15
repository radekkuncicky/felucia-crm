import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { StavDealu } from '@prisma/client'
import Link from 'next/link'
import ReminderPanel from './ReminderPanel'
import ZakazkyDashboardSection from './ZakazkyDashboardSection'
import {
  IconClipboard, IconUsers, IconCoins, IconTrophy, IconTarget,
  IconSnowflake, IconFlame, IconWind, IconHeat, IconFan, IconCog,
  IconPhone, IconMail, IconHandshake, IconNote, IconCheck,
  IconHammer, IconCreditCard, IconSparkles,
} from '@/components/ui/Icons'
import { formatKcCompact } from '@/lib/format'

const stavLabels: Record<StavDealu, string> = {
  NOVY: 'Nový', JEDNANI: 'Jednání', NABIDKA: 'Nabídka',
  PRED_UZAVRENIM: 'Před uzavřením', USPECH: 'Úspěch', PAS: 'Prohráno', ZNEPLATNENO: 'Zneplatněno',
}

const pipelineStages: { stav: StavDealu; bar: string; bg: string; text: string }[] = [
  { stav: 'NOVY',           bar: 'bg-gray-400',    bg: 'bg-gray-100 dark:bg-gray-800',     text: 'text-gray-600 dark:text-gray-300' },
  { stav: 'JEDNANI',        bar: 'bg-blue-500',    bg: 'bg-blue-50 dark:bg-blue-950/40',   text: 'text-blue-700 dark:text-blue-300' },
  { stav: 'NABIDKA',        bar: 'bg-yellow-500',  bg: 'bg-yellow-50 dark:bg-yellow-950/40', text: 'text-yellow-700 dark:text-yellow-300' },
  { stav: 'PRED_UZAVRENIM', bar: 'bg-orange-500',  bg: 'bg-orange-50 dark:bg-orange-950/40', text: 'text-orange-700 dark:text-orange-300' },
  { stav: 'USPECH',         bar: 'bg-green-500',   bg: 'bg-green-50 dark:bg-green-950/40', text: 'text-green-700 dark:text-green-300' },
]

const techIcons: Record<string, React.ReactNode> = {
  KLIMA: <IconSnowflake className="w-4 h-4 text-sky-500" />,
  TEPELNE_CERPADLO: <IconFlame className="w-4 h-4 text-orange-500" />,
  REKUPERACE: <IconWind className="w-4 h-4 text-teal-500" />,
  PODLAHOVE_TOPENI: <IconHeat className="w-4 h-4 text-red-400" />,
  VZDUCHOTECHNIKA: <IconFan className="w-4 h-4 text-indigo-400" />,
  JINE: <IconCog className="w-4 h-4 text-gray-400" />,
}

const actTypIcons: Record<string, React.ReactNode> = {
  HOVOR: <IconPhone className="w-4 h-4 text-sky-500" />,
  EMAIL: <IconMail className="w-4 h-4 text-violet-500" />,
  SCHUZKA: <IconHandshake className="w-4 h-4 text-amber-500" />,
  POZNAMKA: <IconNote className="w-4 h-4 text-gray-400" />,
  UKOL: <IconCheck className="w-4 h-4 text-primary" />,
}

const fmtKc = formatKcCompact

function fmtDate(d: Date) {
  const today = new Date()
  const diff = Math.round((d.getTime() - new Date(today.toDateString()).getTime()) / 86400000)
  if (diff === 0) return 'Dnes'
  if (diff === 1) return 'Zítra'
  if (diff === -1) return 'Včera'
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const in7Days = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
  const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)

  const tomorrow = new Date(today.getTime() + 1 * 24 * 60 * 60 * 1000)
  const dayAfterTomorrow = new Date(today.getTime() + 2 * 24 * 60 * 60 * 1000)

  const [
    clientCount,
    dealsByStav,
    pipelineDeals,
    upcomingActivities,
    upcomingDeadlines,
    recentWins,
    dealsThisMonth,
    clientsThisMonth,
  ] = await Promise.all([
    prisma.client.count({ where: { orgId } }),
    prisma.deal.groupBy({ by: ['stav'], where: { orgId }, _count: true }),
    prisma.deal.findMany({
      where: { orgId, stav: { notIn: ['USPECH', 'PAS', 'ZNEPLATNENO'] } },
      select: {
        quotes: {
          where: { aktivni: true },
          select: {
            dphSazba: true,
            items: { select: { cenaZaKus: true, mnozstvi: true, sleva: true } },
          },
          take: 1,
        },
      },
    }),
    prisma.activity.findMany({
      where: {
        deal: { orgId },
        stav: 'PLANOVANA',
        datum: { gte: today, lte: in7Days },
      },
      include: { deal: { include: { client: { select: { jmeno: true, prijmeni: true } } } }, user: { select: { jmeno: true } } },
      orderBy: { datum: 'asc' },
      take: 12,
    }),
    prisma.deal.findMany({
      where: {
        orgId,
        stav: { notIn: ['PAS', 'USPECH'] },
        OR: [
          { terminRealizace: { gte: today, lte: in30Days } },
          { splatnostZalohy: { gte: today, lte: in30Days } },
        ],
      },
      include: { client: { select: { jmeno: true, prijmeni: true } } },
      orderBy: { terminRealizace: 'asc' },
      take: 6,
    }),
    prisma.deal.findMany({
      where: { orgId, stav: 'USPECH', vytvoreno: { gte: startOfMonth } },
      include: { client: { select: { jmeno: true, prijmeni: true } } },
      orderBy: { vytvoreno: 'desc' },
      take: 5,
    }),
    prisma.deal.count({ where: { orgId, vytvoreno: { gte: startOfMonth } } }),
    prisma.client.count({ where: { orgId, vytvoreno: { gte: startOfMonth } } }),
  ])

  const countByStav = Object.fromEntries(dealsByStav.map(d => [d.stav, d._count])) as Partial<Record<StavDealu, number>>
  const activeDealCount = (['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM'] as StavDealu[])
    .reduce((s, stav) => s + (countByStav[stav] ?? 0), 0)
  const uspechCount = countByStav.USPECH ?? 0
  const pasCount = countByStav.PAS ?? 0
  const winRate = uspechCount + pasCount > 0
    ? Math.round((uspechCount / (uspechCount + pasCount)) * 100)
    : null
  const pipeline = pipelineDeals.reduce((sum, deal) => {
    const q = deal.quotes[0]
    if (!q) return sum
    const cenaBezDph = q.items.reduce((s, i) => s + Number(i.cenaZaKus) * Number(i.mnozstvi) * (1 - Number(i.sleva ?? 0) / 100), 0)
    return sum + cenaBezDph
  }, 0)
  const maxStageCount = Math.max(...pipelineStages.map(s => countByStav[s.stav] ?? 0), 1)

  const role = session!.user.role
  const firstName = session!.user.jmeno.split(' ')[0]
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Dobré ráno' : hour < 18 ? 'Dobrý den' : 'Dobrý večer'

  return (
    <div className="max-w-6xl mx-auto w-full">
    <div className="space-y-6">
      <ReminderPanel />

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{greeting}, {firstName}</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            {new Date().toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <Link href="/deals/new" className="hidden sm:flex items-center gap-2 bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nový případ
        </Link>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          {
            label: 'Aktivní OP',
            value: activeDealCount,
            icon: <IconClipboard className="w-[18px] h-[18px]" />,
            iconBg: 'bg-primary-pale dark:bg-green-950/40 text-primary dark:text-primary-light',
            color: 'text-primary dark:text-primary-light',
            delta: dealsThisMonth > 0 ? `+${dealsThisMonth} tento měsíc` : undefined,
            href: '/deals',
          },
          {
            label: 'Celkem klientů',
            value: clientCount,
            icon: <IconUsers className="w-[18px] h-[18px]" />,
            iconBg: 'bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400',
            color: 'text-purple-600 dark:text-purple-400',
            delta: clientsThisMonth > 0 ? `+${clientsThisMonth} tento měsíc` : undefined,
            href: '/clients',
          },
          {
            label: 'Hodnota pipeline',
            value: pipeline > 0 ? fmtKc(pipeline) : '—',
            icon: <IconCoins className="w-[18px] h-[18px]" />,
            iconBg: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400',
            color: 'text-green-600 dark:text-green-400',
            small: pipeline > 0,
            href: '/deals',
          },
          {
            label: 'Vyhráno (měsíc)',
            value: recentWins.length,
            icon: <IconTrophy className="w-[18px] h-[18px]" />,
            iconBg: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
            color: 'text-amber-600 dark:text-amber-400',
            href: '/deals',
          },
          {
            label: 'Win rate',
            value: winRate !== null ? `${winRate} %` : '—',
            icon: <IconTarget className="w-[18px] h-[18px]" />,
            iconBg: winRate !== null && winRate >= 50 ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400' : 'bg-orange-50 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400',
            color: winRate !== null && winRate >= 50 ? 'text-green-600 dark:text-green-400' : 'text-orange-600 dark:text-orange-400',
            small: true,
            href: '/deals',
          },
        ].map(stat => (
          <Link
            key={stat.label}
            href={stat.href}
            className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-primary-light dark:hover:border-primary-dark hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.iconBg}`}>{stat.icon}</span>
              <svg className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-primary-light transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className={`font-bold ${stat.color} ${stat.small ? 'text-xl' : 'text-3xl'} leading-tight`}>{stat.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{stat.label}</p>
            {'delta' in stat && stat.delta && (
              <p className="text-[11px] font-medium text-primary dark:text-primary-light mt-1 flex items-center gap-0.5">
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 17l9-9m0 0v8m0-8H8" />
                </svg>
                {stat.delta}
              </p>
            )}
          </Link>
        ))}
      </div>

      {/* Pipeline stages */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Pipeline</h2>
          <Link href="/deals?view=kanban" className="text-xs text-primary dark:text-primary-light hover:underline">Kanban →</Link>
        </div>
        <div className="space-y-2.5">
          {pipelineStages.map(stage => {
            const count = countByStav[stage.stav] ?? 0
            const pct = Math.round((count / maxStageCount) * 100)
            return (
              <Link key={stage.stav} href={`/deals`} className="flex items-center gap-3 group">
                <span className="text-xs text-gray-500 dark:text-slate-400 w-28 flex-shrink-0 text-right">
                  {stavLabels[stage.stav]}
                </span>
                <div className="flex-1 h-6 bg-gray-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${stage.bar} transition-all duration-500`}
                    style={{ width: count > 0 ? `${Math.max(pct, 4)}%` : '0%' }}
                  />
                </div>
                <span className={`text-sm font-bold w-6 text-right flex-shrink-0 ${count > 0 ? stage.text : 'text-gray-300 dark:text-slate-600'}`}>
                  {count}
                </span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Two column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Upcoming activities */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Plánované aktivity</h2>
            <div className="flex items-center gap-3">
              <Link href="/calendar" className="text-xs text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light">Kalendář →</Link>
              <Link href="/activities" className="text-xs text-primary dark:text-primary-light hover:underline">Vše →</Link>
            </div>
          </div>
          {upcomingActivities.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <IconSparkles className="w-8 h-8 mb-2 text-primary-light" />
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádné plánované aktivity</p>
              <Link href="/deals" className="mt-2 text-xs text-primary dark:text-primary-light hover:underline">Otevřít obchodní případ →</Link>
            </div>
          ) : (
            <UpcomingActivitiesGroups activities={upcomingActivities} today={today} tomorrow={tomorrow} dayAfterTomorrow={dayAfterTomorrow} />
          )}
        </div>

        {/* Right column: deadlines + recent wins */}
        <div className="space-y-5">
          {/* Upcoming deadlines */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 dark:text-white">Blížící se termíny</h2>
              <Link href="/calendar" className="text-xs text-primary dark:text-primary-light hover:underline">Kalendář →</Link>
            </div>
            {upcomingDeadlines.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Žádné blížící se termíny</p>
            ) : (
              <div className="space-y-2">
                {upcomingDeadlines.flatMap(deal => {
                  const rows = []
                  if (deal.terminRealizace) {
                    const d = new Date(deal.terminRealizace)
                    const urgent = d <= new Date(Date.now() + 7 * 86400000)
                    rows.push(
                      <Link key={`${deal.id}-rea`} href={`/deals/${deal.id}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-1 transition-colors"
                      >
                        <span className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0"><IconHammer className="w-4 h-4 text-orange-500" /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-slate-200 truncate">
                            {deal.client.jmeno} {deal.client.prijmeni}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">Realizace</p>
                        </div>
                        <span className={`text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-950/40 text-orange-600 dark:text-orange-400'}`}>
                          {fmtDate(d)}
                        </span>
                      </Link>
                    )
                  }
                  if (deal.splatnostZalohy) {
                    const d = new Date(deal.splatnostZalohy)
                    const urgent = d <= new Date(Date.now() + 7 * 86400000)
                    rows.push(
                      <Link key={`${deal.id}-zal`} href={`/deals/${deal.id}`}
                        className="flex items-center gap-3 p-2 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-1 transition-colors"
                      >
                        <span className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0"><IconCreditCard className="w-4 h-4 text-amber-500" /></span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-slate-200 truncate">
                            {deal.client.jmeno} {deal.client.prijmeni}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-slate-500">Záloha</p>
                        </div>
                        <span className={`text-xs font-medium flex-shrink-0 px-2 py-0.5 rounded-full ${urgent ? 'bg-red-100 dark:bg-red-950/40 text-red-600 dark:text-red-400' : 'bg-amber-100 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400'}`}>
                          {fmtDate(d)}
                        </span>
                      </Link>
                    )
                  }
                  return rows
                })}
              </div>
            )}
          </div>

          {/* Recent wins */}
          {recentWins.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <IconTrophy className="w-[18px] h-[18px] text-amber-500" /> Vyhráno tento měsíc
              </h2>
              <div className="space-y-2">
                {recentWins.map(deal => (
                  <Link key={deal.id} href={`/deals/${deal.id}`}
                    className="flex items-center gap-3 p-2 rounded-xl hover:bg-green-50 dark:hover:bg-green-950/20 -mx-1 transition-colors"
                  >
                    <span className="flex-shrink-0">{techIcons[deal.technologie] ?? <IconCog className="w-4 h-4 text-gray-400" />}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                        {deal.client.jmeno} {deal.client.prijmeni}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{deal.predmet ?? 'Bez předmětu'}</p>
                    </div>
                    <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Zakázky section for managers */}
      {role === 'ADMIN' && (
        <ZakazkyDashboardSection orgId={orgId} />
      )}

      {/* Technik: assigned orders & protocols */}
      {role === 'TECHNIK' && (
        <TechnikDashboardSection userId={session!.user.id} orgId={orgId} />
      )}
    </div>
    </div>
  )
}

function UpcomingActivitiesGroups({
  activities,
  today,
  tomorrow,
  dayAfterTomorrow,
}: {
  activities: Array<{ id: string; typ: string; popis: string | null; datum: Date; deal: { id: string; client: { jmeno: string; prijmeni: string } }; user: { jmeno: string } | null }>
  today: Date
  tomorrow: Date
  dayAfterTomorrow: Date
}) {
  function datePart(d: Date) { return d.toISOString().split('T')[0] }
  const todayStr  = datePart(today)
  const tomStr    = datePart(tomorrow)
  const afterStr  = datePart(dayAfterTomorrow)

  const groups = [
    { label: 'Dnes',       dot: 'bg-red-500', color: 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30', items: activities.filter(a => datePart(a.datum) === todayStr) },
    { label: 'Zítra',      dot: 'bg-amber-500', color: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30', items: activities.filter(a => datePart(a.datum) === tomStr) },
    { label: 'Tento týden', dot: 'bg-gray-400', color: 'text-gray-600 dark:text-slate-400 bg-gray-50 dark:bg-slate-700/40', items: activities.filter(a => datePart(a.datum) >= afterStr) },
  ].filter(g => g.items.length > 0)

  return (
    <div className="space-y-3">
      {groups.map(group => (
        <div key={group.label}>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${group.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${group.dot}`} /> {group.label}
          </span>
          <div className="space-y-1">
            {group.items.map(act => (
              <Link
                key={act.id}
                href={`/deals/${act.deal.id}?tab=aktivity`}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-1"
              >
                <span className="flex-shrink-0">{actTypIcons[act.typ] ?? <IconNote className="w-4 h-4 text-gray-400" />}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">
                    {act.popis ?? '—'}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 truncate">
                    {act.deal.client.jmeno} {act.deal.client.prijmeni}
                    {act.user?.jmeno ? ` · ${act.user.jmeno}` : ''}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

async function TechnikDashboardSection({ userId, orgId }: { userId: string; orgId: string }) {
  const [zakazky, predavaky] = await Promise.all([
    prisma.technikZakazka.findMany({
      where: { technikId: userId, zakazka: { orgId, stav: { notIn: ['HOTOVO'] } } },
      include: {
        zakazka: {
          select: { id: true, cislo: true, nazev: true, stav: true, klient: { select: { jmeno: true, prijmeni: true } } },
        },
      },
      orderBy: { prirazeno: 'desc' },
      take: 10,
    }),
    prisma.predavak.findMany({
      where: { technikId: userId, orgId, stav: 'ROZPRACOVAN' },
      include: {
        zakazka: { select: { id: true, cislo: true, nazev: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ])

  const STAV_LABELS_ZAK: Record<string, string> = {
    NOVA: 'Nová', PRIRAZENA: 'Přiřazena', V_REALIZACI: 'V realizaci',
    PREDANA: 'Předána', VYUCTOVANA: 'Vyúčtována', HOTOVO: 'Hotovo',
  }
  const STAV_COLORS_ZAK: Record<string, string> = {
    NOVA: 'text-gray-500', PRIRAZENA: 'text-blue-600', V_REALIZACI: 'text-orange-600',
    PREDANA: 'text-purple-600', VYUCTOVANA: 'text-yellow-600', HOTOVO: 'text-green-600',
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Moje zakázky</h2>
          <Link href="/zakazky" className="text-xs text-primary dark:text-primary-light hover:underline">Zobrazit vše →</Link>
        </div>
        {zakazky.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Žádné aktivní zakázky</p>
        ) : (
          <div className="space-y-2">
            {zakazky.map(rel => (
              <Link key={rel.id} href={`/zakazky/${rel.zakazka.id}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700/50 -mx-1 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{rel.zakazka.cislo} · {rel.zakazka.nazev}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{rel.zakazka.klient.jmeno} {rel.zakazka.klient.prijmeni}</p>
                </div>
                <span className={`text-xs font-medium flex-shrink-0 ${STAV_COLORS_ZAK[rel.zakazka.stav] ?? 'text-gray-500'}`}>
                  {STAV_LABELS_ZAK[rel.zakazka.stav]}
                </span>
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Protokoly k vyplnění</h2>
          <Link href="/predavaky" className="text-xs text-primary dark:text-primary-light hover:underline">Zobrazit vše →</Link>
        </div>
        {predavaky.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500 py-2">Žádné rozpracované protokoly</p>
        ) : (
          <div className="space-y-2">
            {predavaky.map(p => (
              <Link key={p.id} href={`/zakazky/${p.zakazka.id}/predavaky/${p.id}`}
                className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-orange-50 dark:hover:bg-orange-950/20 -mx-1 transition-colors"
              >
                <span className="w-7 h-7 rounded-lg bg-orange-50 dark:bg-orange-950/40 flex items-center justify-center flex-shrink-0"><IconClipboard className="w-4 h-4 text-orange-500" /></span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{p.cislo}</p>
                  <p className="text-xs text-gray-400 dark:text-slate-500">{p.zakazka.cislo} · {p.zakazka.nazev}</p>
                </div>
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400 flex-shrink-0">Rozpracován</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
