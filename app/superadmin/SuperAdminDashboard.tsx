'use client'
import { formatDate, formatKcPresne } from '@/lib/format'

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-600',
  STANDARD: 'bg-green-600',
  PROFESSIONAL: 'bg-blue-600',
  ENTERPRISE: 'bg-purple-600',
}

const PLAN_LABELS: Record<string, string> = {
  STARTER: 'Starter',
  STANDARD: 'Standard',
  PROFESSIONAL: 'Professional',
  ENTERPRISE: 'Enterprise',
}

interface Props {
  stats: { totalOrgs: number; activeOrgs: number; totalUsers: number; mrr: number }
  planDistribution: Array<{ plan: string; count: number }>
  recentOrgs: Array<{ id: string; nazev: string; plan: string; aktivni: boolean; vytvoreno: string; email: string | null }>
}

export default function SuperAdminDashboard({ stats, planDistribution, recentOrgs }: Props) {
  const totalForChart = planDistribution.reduce((s, p) => s + p.count, 0) || 1

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Přehled</h1>
        <p className="text-gray-400 mt-1">Celkový stav platformy Felucia CRM</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-6 mb-8">
        <StatCard
          label="Organizace celkem"
          value={stats.totalOrgs}
          sub={`${stats.activeOrgs} aktivních`}
          color="text-blue-400"
        />
        <StatCard
          label="Aktivní organizace"
          value={stats.activeOrgs}
          sub={`${stats.totalOrgs - stats.activeOrgs} neaktivních`}
          color="text-green-400"
        />
        <StatCard
          label="Uživatelé celkem"
          value={stats.totalUsers}
          sub="napříč všemi orgs"
          color="text-purple-400"
        />
        <StatCard
          label="MRR (odhadované)"
          value={`${formatKcPresne(stats.mrr)}`}
          sub="měsíční příjmy"
          color="text-yellow-400"
        />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Plan distribution */}
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="font-semibold text-white mb-4">Distribuce plánů</h2>
          <div className="space-y-3">
            {planDistribution.map(p => (
              <div key={p.plan}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-300">{PLAN_LABELS[p.plan] ?? p.plan}</span>
                  <span className="text-gray-400">{p.count} org</span>
                </div>
                <div className="w-full bg-gray-800 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${PLAN_COLORS[p.plan] ?? 'bg-gray-500'}`}
                    style={{ width: `${(p.count / totalForChart) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent registrations */}
        <div className="col-span-2 bg-gray-900 rounded-xl p-6 border border-gray-800">
          <h2 className="font-semibold text-white mb-4">Poslední registrace</h2>
          <div className="space-y-2">
            {recentOrgs.map(org => (
              <div key={org.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                <div>
                  <p className="text-sm font-medium text-white">{org.nazev}</p>
                  <p className="text-xs text-gray-500">{org.email ?? '—'}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[org.plan] ?? 'bg-gray-600'} text-white`}>
                    {PLAN_LABELS[org.plan] ?? org.plan}
                  </span>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${org.aktivni ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {org.aktivni ? 'Aktivní' : 'Neaktivní'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDate(org.vytvoreno)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, sub, color }: {
  label: string
  value: string | number
  sub: string
  color: string
}) {
  return (
    <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
      <p className={`text-2xl font-bold text-white ${color}`}>{value}</p>
      <p className="text-sm text-gray-300 mt-1">{label}</p>
      <p className="text-xs text-gray-500 mt-0.5">{sub}</p>
    </div>
  )
}
