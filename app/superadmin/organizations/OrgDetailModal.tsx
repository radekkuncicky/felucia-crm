'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/format'

const PLANS = ['STARTER', 'STANDARD', 'PROFESSIONAL', 'ENTERPRISE']

interface Org {
  id: string
  nazev: string
  slug: string
  email: string | null
  plan: string
  aktivni: boolean
  vytvoreno: string
  planActiveTo: string | null
  stripeCustomerId: string | null
  _count: { users: number; deals: number; clients: number }
  orgSettings: { modulServis: boolean; modulAnalytiky: boolean; modulDokumenty: boolean; modulDasa: boolean } | null
}

interface Props {
  org: Org
  onClose: () => void
  onUpdate: (id: string, data: Partial<{ plan: string; aktivni: boolean }>) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onImpersonate: (orgId: string) => Promise<void>
}

export default function OrgDetailModal({ org, onClose, onUpdate, onDelete, onImpersonate }: Props) {
  const [plan, setPlan] = useState(org.plan)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    setSaving(true)
    await onUpdate(org.id, { plan })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-lg font-semibold text-white">{org.nazev}</h2>
            <p className="text-sm text-gray-400 mt-0.5">{org.email ?? org.slug}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Uživatelé', value: org._count.users },
              { label: 'Obch. případy', value: org._count.deals },
              { label: 'Klienti', value: org._count.clients },
            ].map(s => (
              <div key={s.label} className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-white">{s.value}</p>
                <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Info */}
          <div className="space-y-2 text-sm">
            <InfoRow label="ID" value={org.id} />
            <InfoRow label="Slug" value={org.slug} />
            <InfoRow label="Registrace" value={formatDate(org.vytvoreno)} />
            <InfoRow label="Platnost plánu" value={org.planActiveTo ? formatDate(org.planActiveTo) : 'Neurčeno'} />
            <InfoRow label="Stripe Customer ID" value={org.stripeCustomerId ?? '—'} />
            <InfoRow label="Stav" value={org.aktivni ? 'Aktivní' : 'Neaktivní'} />
          </div>

          {/* Plan change */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">Plán</label>
            <div className="flex gap-2">
              <select
                value={plan}
                onChange={e => setPlan(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-yellow-500"
              >
                {PLANS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
              <button
                onClick={save}
                disabled={saving || plan === org.plan}
                className="px-3 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? 'Ukládám...' : 'Uložit'}
              </button>
            </div>
          </div>

          {/* Feature flags */}
          {org.orgSettings && (
            <div>
              <p className="text-xs text-gray-400 mb-2">Aktivní moduly</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(org.orgSettings).map(([key, val]) => (
                  <span
                    key={key}
                    className={`text-xs px-2 py-0.5 rounded-full ${val ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500 line-through'}`}
                  >
                    {key.replace('modul', '')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => onUpdate(org.id, { aktivni: !org.aktivni })}
              className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                org.aktivni
                  ? 'bg-orange-900 text-orange-300 hover:bg-orange-800'
                  : 'bg-green-900 text-green-300 hover:bg-green-800'
              }`}
            >
              {org.aktivni ? 'Deaktivovat' : 'Aktivovat'}
            </button>
            <button
              onClick={() => onDelete(org.id)}
              className="px-3 py-1.5 text-sm rounded-lg font-medium bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
            >
              Smazat
            </button>
          </div>
          <button
            onClick={() => onImpersonate(org.id)}
            className="px-3 py-1.5 text-sm bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg transition-colors"
          >
            Zobrazit jako org
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 font-mono text-xs">{value}</span>
    </div>
  )
}
