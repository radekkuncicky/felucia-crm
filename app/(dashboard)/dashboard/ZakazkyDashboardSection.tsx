import { prisma } from '@/lib/prisma'
import Link from 'next/link'

export default async function ZakazkyDashboardSection({ orgId }: { orgId: string }) {
  const [aktivni, vRealizaci, cekajPP, nevyuctovano, podpisanePP] = await Promise.all([
    prisma.zakazka.count({ where: { orgId, stav: { notIn: ['HOTOVO'] } } }),
    prisma.zakazka.count({ where: { orgId, stav: 'V_REALIZACI' } }),
    prisma.predavak.count({ where: { orgId, stav: 'PODPISAN' } }),
    prisma.zakazka.count({ where: { orgId, stav: 'PREDANA' } }),
    prisma.predavak.findMany({
      where: { orgId, stav: 'PODPISAN' },
      include: {
        zakazka: { select: { id: true, cislo: true, nazev: true } },
        technik: { select: { jmeno: true } },
      },
      orderBy: { podpisano: 'asc' },
      take: 10,
    }),
  ])

  const kpis = [
    { label: 'Aktivní zakázky', value: aktivni, icon: '🔧', href: '/zakazky', color: 'text-primary dark:text-primary-light' },
    { label: 'V realizaci', value: vRealizaci, icon: '⚙️', href: '/zakazky', color: 'text-orange-600 dark:text-orange-400' },
    { label: 'Čekají na schválení PP', value: cekajPP, icon: '📋', href: '/predavaky', color: cekajPP > 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-500 dark:text-slate-400' },
    { label: 'Nevyúčtováno', value: nevyuctovano, icon: '💳', href: '/zakazky', color: nevyuctovano > 0 ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-500 dark:text-slate-400' },
  ]

  return (
    <div className="space-y-4 mt-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white">Zakázky</h2>
        <Link href="/zakazky" className="text-xs text-primary dark:text-primary-light hover:underline">Přejít na zakázky →</Link>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {kpis.map(k => (
          <Link key={k.label} href={k.href}
            className="group bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 hover:border-primary-light dark:hover:border-primary-dark hover:shadow-sm transition-all"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xl">{k.icon}</span>
              <svg className="w-3.5 h-3.5 text-gray-300 dark:text-slate-600 group-hover:text-blue-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
            <p className={`font-bold text-3xl leading-tight ${k.color}`}>{k.value}</p>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{k.label}</p>
          </Link>
        ))}
      </div>

      {/* Podepsané PP ke schválení */}
      {podpisanePP.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">
            📋 Zakázky ke schválení ({podpisanePP.length})
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700">
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">PP číslo</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Zakázka</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Technik</th>
                  <th className="text-left py-2 pr-4 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Podpis</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {podpisanePP.map(pp => (
                  <tr key={pp.id} className="border-b border-gray-50 dark:border-slate-700/50 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                    <td className="py-2.5 pr-4">
                      <span className="font-mono text-xs font-bold text-green-600 dark:text-green-400">{pp.cislo}</span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className="text-gray-800 dark:text-slate-200">{pp.zakazka.cislo}</span>
                      <span className="text-gray-400 dark:text-slate-500 ml-1 text-xs hidden sm:inline">· {pp.zakazka.nazev}</span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600 dark:text-slate-400">{pp.technik.jmeno}</td>
                    <td className="py-2.5 pr-4 text-gray-400 dark:text-slate-500">
                      {pp.podpisano ? new Date(pp.podpisano).toLocaleDateString('cs-CZ') : '—'}
                    </td>
                    <td className="py-2.5">
                      <Link
                        href={`/zakazky/${pp.zakazka.id}/predavaky/${pp.id}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary dark:text-primary-light hover:underline"
                      >
                        Schválit →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
