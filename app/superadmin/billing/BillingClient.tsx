'use client'
import { formatDate, formatCislo } from '@/lib/format'

const PLAN_COLORS: Record<string, string> = {
  STARTER: 'bg-gray-700 text-gray-200',
  STANDARD: 'bg-green-900 text-green-200',
  PROFESSIONAL: 'bg-blue-900 text-blue-200',
  ENTERPRISE: 'bg-purple-900 text-purple-200',
}

const PLAN_PRICES: Record<string, number> = { STARTER: 49, STANDARD: 999, PROFESSIONAL: 1499, ENTERPRISE: 0 }

interface Org {
  id: string
  nazev: string
  plan: string
  aktivni: boolean
  planActiveTo: string | null
  stripeCustomerId: string | null
  stripePlanId: string | null
  email: string | null
  price: number
}

interface Props {
  mrr: number
  planDistribution: Array<{ plan: string; count: number }>
  orgs: Org[]
}

export default function BillingClient({ mrr, planDistribution, orgs }: Props) {
  const arr = mrr * 12

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Fakturace</h1>
        <p className="text-gray-400 mt-1">Přehled příjmů a Stripe integrace</p>
      </div>

      {/* Revenue stats */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-2xl font-bold text-yellow-400">{formatCislo(mrr)} Kč</p>
          <p className="text-sm text-gray-300 mt-1">MRR (odhadované)</p>
          <p className="text-xs text-gray-500 mt-0.5">Monthly Recurring Revenue</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-2xl font-bold text-green-400">{formatCislo(arr)} Kč</p>
          <p className="text-sm text-gray-300 mt-1">ARR (odhadované)</p>
          <p className="text-xs text-gray-500 mt-0.5">Annual Recurring Revenue</p>
        </div>
        <div className="bg-gray-900 rounded-xl p-6 border border-gray-800">
          <p className="text-2xl font-bold text-blue-400">{orgs.filter(o => o.stripeCustomerId).length}</p>
          <p className="text-sm text-gray-300 mt-1">Stripe zákazníci</p>
          <p className="text-xs text-gray-500 mt-0.5">Platící organizace</p>
        </div>
      </div>

      {/* Plan breakdown */}
      <div className="grid grid-cols-3 gap-6 mb-8">
        {planDistribution.filter(p => p.plan !== 'STARTER').map(p => (
          <div key={p.plan} className="bg-gray-900 rounded-xl p-5 border border-gray-800">
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[p.plan] ?? 'bg-gray-700 text-gray-200'}`}>
                {p.plan}
              </span>
              <span className="text-lg font-bold text-white">{p.count}x</span>
            </div>
            <p className="text-sm text-gray-400">
              {(p.count * (PLAN_PRICES[p.plan] ?? 0)).toLocaleString('cs-CZ')} Kč/měs
            </p>
          </div>
        ))}
      </div>

      {/* Paying orgs table */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-semibold text-white">Platící organizace</h2>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-gray-400 font-medium">Organizace</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Plán</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Cena/měs</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Platnost do</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Stripe ID</th>
            </tr>
          </thead>
          <tbody>
            {orgs.map(org => (
              <tr key={org.id} className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors">
                <td className="px-6 py-3">
                  <p className="font-medium text-white">{org.nazev}</p>
                  <p className="text-xs text-gray-500">{org.email ?? '—'}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PLAN_COLORS[org.plan] ?? 'bg-gray-700 text-gray-200'}`}>
                    {org.plan}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-300">{formatCislo(org.price)} Kč</td>
                <td className="px-4 py-3 text-gray-400 text-xs">
                  {org.planActiveTo ? formatDate(org.planActiveTo) : '—'}
                </td>
                <td className="px-4 py-3 text-gray-500 font-mono text-xs">
                  {org.stripeCustomerId ?? '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orgs.length === 0 && (
          <div className="py-12 text-center text-gray-500">Žádné platící organizace</div>
        )}
      </div>
    </div>
  )
}
