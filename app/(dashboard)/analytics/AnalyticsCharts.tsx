'use client'

import { useState } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface DealRow {
  id: string
  kod: string
  klient: string
  stav: string
  jmeno: string
  konecnaCena: number
  vytvoreno: string
}

interface Props {
  funnelData: { stav: string; label: string; count: number; value: number }[]
  monthlyData: { month: string; count: number; value: number; uspech: number }[]
  userData: { jmeno: string; total: number; uspech: number; value: number }[]
  deals: DealRow[]
}

const stavColors: Record<string, string> = {
  NOVY: '#94a3b8',
  JEDNANI: '#3b82f6',
  NABIDKA: '#f59e0b',
  PRED_UZAVRENIM: '#f97316',
  USPECH: '#22c55e',
  PAS: '#ef4444',
}

function fmtKc(v: number) {
  return (v / 1000).toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' tis Kč'
}

const stavBadgeColors: Record<string, string> = {
  NOVY: 'bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-slate-300',
  JEDNANI: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  NABIDKA: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  PRED_UZAVRENIM: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  USPECH: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  PAS: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
}

const stavLabelMap: Record<string, string> = {
  NOVY: 'Nový', JEDNANI: 'Jednání', NABIDKA: 'Nabídka',
  PRED_UZAVRENIM: 'Před uzavřením', USPECH: 'Úspěch', PAS: 'Prohráno',
}

function DealsTable({ deals, sortKey }: { deals: DealRow[]; sortKey: 'stav' | 'vytvoreno' | 'jmeno' }) {
  const stavOrder = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS']
  const sorted = [...deals].sort((a, b) => {
    if (sortKey === 'stav') return stavOrder.indexOf(a.stav) - stavOrder.indexOf(b.stav)
    if (sortKey === 'vytvoreno') return new Date(b.vytvoreno).getTime() - new Date(a.vytvoreno).getTime()
    if (sortKey === 'jmeno') return a.jmeno.localeCompare(b.jmeno) || b.konecnaCena - a.konecnaCena
    return 0
  })
  if (sorted.length === 0) return <p className="text-sm text-gray-400 dark:text-slate-500">Žádné projekty</p>
  return (
    <div className="mt-5 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 dark:border-slate-700">
            <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Kód</th>
            <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Klient</th>
            <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Stav</th>
            <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Obchodník</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Hodnota</th>
            <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Datum</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 dark:divide-slate-700/60">
          {sorted.map(d => (
            <tr key={d.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
              <td className="py-2.5">
                <Link href={`/deals/${d.id}`} className="font-mono text-xs text-primary dark:text-primary-light hover:underline">{d.kod}</Link>
              </td>
              <td className="py-2.5 text-gray-900 dark:text-white max-w-[200px] truncate">{d.klient}</td>
              <td className="py-2.5">
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${stavBadgeColors[d.stav] ?? ''}`}>
                  {stavLabelMap[d.stav] ?? d.stav}
                </span>
              </td>
              <td className="py-2.5 text-gray-600 dark:text-slate-400">{d.jmeno}</td>
              <td className="py-2.5 text-right font-semibold text-gray-900 dark:text-white">{fmtKc(d.konecnaCena)}</td>
              <td className="py-2.5 text-right text-gray-500 dark:text-slate-400 text-xs">{new Date(d.vytvoreno).toLocaleDateString('cs-CZ')}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AnalyticsCharts({ funnelData, monthlyData, userData, deals }: Props) {
  const [activeCard, setActiveCard] = useState<string | null>(null)

  function toggleCard(id: string) {
    setActiveCard(prev => (prev === id ? null : id))
  }

  // KPI summary
  const totalDeals = funnelData.reduce((s, f) => s + f.count, 0)
  const uspechDeals = funnelData.find(f => f.stav === 'USPECH')
  const aktDeals = funnelData.filter(f => !['USPECH', 'PAS'].includes(f.stav))
  const totalAktivni = aktDeals.reduce((s, f) => s + f.count, 0)
  const totalValue = aktDeals.reduce((s, f) => s + f.value, 0)
  const totalUspech = funnelData.filter(f => f.stav !== 'PAS').reduce((s, f) => s + f.count, 0)
  const konverzni = totalUspech > 0 ? Math.round(((uspechDeals?.count ?? 0) / totalUspech) * 100) : 0

  const cardClass = (id: string) =>
    `bg-white dark:bg-slate-800 rounded-xl border p-5 cursor-pointer transition-all ${
      activeCard === id
        ? 'border-blue-400 dark:border-blue-600 shadow-md ring-1 ring-blue-300 dark:ring-blue-700'
        : 'border-gray-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-sm'
    }`

  const titleClass = 'text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3'

  // Funnel data with colors for recharts
  const funnelChartData = funnelData.map(f => ({
    ...f,
    fill: stavColors[f.stav] ?? '#94a3b8',
  }))

  // Compute conversion between stages
  const funnelWithConv = funnelData.map((f, i) => {
    const prev = i > 0 ? funnelData[i - 1].count : null
    const conv = prev && prev > 0 ? Math.round((f.count / prev) * 100) : null
    return { ...f, conv }
  })

  return (
    <div className="space-y-8">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Celkem OP</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{totalDeals}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Aktivní</p>
          <p className="text-3xl font-bold text-primary dark:text-primary-light">{totalAktivni}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{fmtKc(totalValue)} pipeline</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Úspěchy</p>
          <p className="text-3xl font-bold text-green-600 dark:text-green-400">{uspechDeals?.count ?? 0}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">{fmtKc(uspechDeals?.value ?? 0)}</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">Konverzní poměr</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{konverzni} %</p>
        </div>
      </div>

      {/* Section: Prodej */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Prodej</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

          {/* Card 1: Prodejní trychtýř */}
          <div className={cardClass('trychtyr')} onClick={() => toggleCard('trychtyr')}>
            <p className={titleClass}>Prodejní trychtýř</p>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={funnelData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                  {funnelData.map(f => (
                    <Cell key={f.stav} fill={stavColors[f.stav] ?? '#94a3b8'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{totalDeals} OP celkem</p>
          </div>

          {/* Card 2: Vývoj prodeje */}
          <div className={cardClass('vyvoj')} onClick={() => toggleCard('vyvoj')}>
            <p className={titleClass}>Vývoj prodeje (12 měsíců)</p>
            <ResponsiveContainer width="100%" height={60}>
              <LineChart data={monthlyData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
                <Line type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="count" stroke="#22c55e" strokeWidth={1.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">Hodnota a počet OP</p>
          </div>

          {/* Card 3: Prodej dle obchodníků */}
          <div className={cardClass('obchodnici_bar')} onClick={() => toggleCard('obchodnici_bar')}>
            <p className={titleClass}>Prodej dle obchodníků</p>
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={userData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="value" fill="#3b82f6" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{userData.length} obchodníků</p>
          </div>
        </div>

        {/* Expanded: Prodejní trychtýř */}
        {activeCard === 'trychtyr' && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Prodejní trychtýř — detail</h3>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Horizontal bar funnel with conversion */}
              <div className="space-y-2">
                {funnelWithConv.map(f => {
                  const max = Math.max(...funnelData.map(d => d.count), 1)
                  const pct = (f.count / max) * 100
                  return (
                    <div key={f.stav}>
                      {f.conv !== null && (
                        <div className="flex items-center gap-2 mb-0.5 pl-36">
                          <div className="w-px h-3 bg-gray-300 dark:bg-slate-600" />
                          <span className="text-xs text-gray-400 dark:text-slate-500">{f.conv}% konverze</span>
                        </div>
                      )}
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-gray-600 dark:text-slate-400 w-32 text-right shrink-0">{f.label}</span>
                        <div className="flex-1 h-8 bg-gray-100 dark:bg-slate-700 rounded-lg overflow-hidden">
                          <div
                            className="h-full rounded-lg transition-all flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: stavColors[f.stav] ?? '#94a3b8' }}
                          >
                            {f.count > 0 && <span className="text-white text-xs font-semibold">{f.count}</span>}
                          </div>
                        </div>
                        <span className="text-sm text-gray-500 dark:text-slate-400 w-28 text-right shrink-0">{fmtKc(f.value)}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Recharts funnel / bar */}
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v) => [v, 'Počet']} />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                    {funnelChartData.map(f => (
                      <Cell key={f.stav} fill={f.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <DealsTable deals={deals} sortKey="stav" />
          </div>
        )}

        {/* Expanded: Vývoj prodeje */}
        {activeCard === 'vyvoj' && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Vývoj prodeje (posledních 12 měsíců)</h3>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyData} margin={{ top: 5, right: 20, bottom: 5, left: 20 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="val" orientation="left" tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <YAxis yAxisId="cnt" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v, name) => {
                    if (name === 'value') return [fmtKc(Number(v)), 'Hodnota']
                    if (name === 'count') return [v, 'Nové OP']
                    return [v, 'Úspěchy']
                  }}
                />
                <Line yAxisId="val" type="monotone" dataKey="value" stroke="#3b82f6" strokeWidth={2} dot={false} name="value" />
                <Line yAxisId="cnt" type="monotone" dataKey="count" stroke="#94a3b8" strokeWidth={1.5} dot={false} name="count" />
                <Line yAxisId="cnt" type="monotone" dataKey="uspech" stroke="#22c55e" strokeWidth={2} dot={false} name="uspech" />
              </LineChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-6 mt-3">
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-blue-500 inline-block rounded" /><span className="text-xs text-gray-500 dark:text-slate-400">Hodnota OP</span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-slate-400 inline-block rounded" /><span className="text-xs text-gray-500 dark:text-slate-400">Nové OP</span></div>
              <div className="flex items-center gap-2"><span className="w-4 h-0.5 bg-green-500 inline-block rounded" /><span className="text-xs text-gray-500 dark:text-slate-400">Úspěchy</span></div>
            </div>
            <DealsTable deals={deals} sortKey="vytvoreno" />
          </div>
        )}

        {/* Expanded: Prodej dle obchodníků */}
        {activeCard === 'obchodnici_bar' && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Prodej dle obchodníků</h3>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={userData} margin={{ top: 5, right: 20, bottom: 20, left: 20 }}>
                <XAxis dataKey="jmeno" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                <Tooltip formatter={(v) => [fmtKc(Number(v)), 'Hodnota OP']} />
                <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <DealsTable deals={deals} sortKey="jmeno" />
          </div>
        )}
      </div>

      {/* Section: Obchodníci */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wider mb-3">Obchodníci</h2>
        <div className="grid grid-cols-1 gap-4">

          {/* Card 4: Úspěšnost obchodníků (table) */}
          <div className={cardClass('obchodnici_table')} onClick={() => toggleCard('obchodnici_table')}>
            <p className={titleClass}>Úspěšnost obchodníků</p>
            {/* Mini preview: small bar chart */}
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={userData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="total" fill="#94a3b8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="uspech" fill="#22c55e" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-2">{userData.length} obchodníků · klikněte pro tabulku</p>
          </div>
        </div>

        {/* Expanded: Úspěšnost table */}
        {activeCard === 'obchodnici_table' && (
          <div className="mt-4 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Úspěšnost obchodníků</h3>
            {userData.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádná data</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-slate-700">
                      <th className="text-left py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Obchodník</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Celkem OP</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Výhry</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Prohry</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">% Úspěšnost</th>
                      <th className="text-right py-2 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Hodnota</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                    {userData.map(u => {
                      const prohry = u.total - u.uspech
                      const pct = u.total > 0 ? Math.round((u.uspech / u.total) * 100) : 0
                      return (
                        <tr key={u.jmeno}>
                          <td className="py-3 font-medium text-gray-900 dark:text-white">{u.jmeno}</td>
                          <td className="py-3 text-right text-gray-600 dark:text-slate-400">{u.total}</td>
                          <td className="py-3 text-right text-green-600 dark:text-green-400">{u.uspech}</td>
                          <td className="py-3 text-right text-red-500 dark:text-red-400">{prohry}</td>
                          <td className="py-3 text-right">
                            <span className={`font-semibold ${pct >= 50 ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-slate-400'}`}>
                              {pct} %
                            </span>
                          </td>
                          <td className="py-3 text-right font-semibold text-gray-900 dark:text-white">{fmtKc(u.value)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
