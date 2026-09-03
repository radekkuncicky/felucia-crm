'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { resolvePermissions } from '@/lib/permissions'

interface OrgUser {
  id: string
  jmeno: string
  email: string
  role: string
  aktivni: boolean
  permissions: unknown
}

export default function ZakazkySettingsPage() {
  const [users, setUsers] = useState<OrgUser[]>([])
  const [defaultVedouciId, setDefaultVedouciId] = useState('')
  const [autoAssign, setAutoAssign] = useState(false)
  const [autoVyuctovani, setAutoVyuctovani] = useState(true)
  const [prefix, setPrefix] = useState('')
  const [defaultDph, setDefaultDph] = useState(12)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      fetch('/api/settings/zakazky').then(r => r.json()),
      fetch('/api/settings/users').then(r => r.json()),
    ]).then(([settings, usersData]) => {
      if (settings) {
        setDefaultVedouciId(settings.zakazkyDefaultVedouciId ?? '')
        setAutoAssign(settings.zakazkyAutoAssignVedouci ?? false)
        setAutoVyuctovani(settings.zakazkyAutoVyuctovani ?? true)
        setPrefix(settings.zakazkyPrefix ?? '')
        setDefaultDph(settings.zakazkyDefaultDph ?? 12)
      }
      if (Array.isArray(usersData)) setUsers(usersData)
    }).finally(() => setLoading(false))
  }, [])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/settings/zakazky', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zakazkyDefaultVedouciId: defaultVedouciId || null,
          zakazkyAutoAssignVedouci: autoAssign,
          zakazkyAutoVyuctovani: autoVyuctovani,
          zakazkyPrefix: prefix || null,
          zakazkyDefaultDph: defaultDph,
        }),
      })
      if (res.ok) {
        setToast('Uloženo')
        setTimeout(() => setToast(null), 3000)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl">
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 px-4 py-3 rounded-xl shadow-xl bg-green-600 text-white text-sm font-medium">{toast}</div>
      )}

      <div className="mb-6">
        <Link href="/settings" className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">← Nastavení</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-2">Nastavení zakázek</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">Výchozí chování modulu Zakázky</p>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-gray-200 dark:bg-slate-700 rounded-xl" />)}
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">

          {/* Default vedoucí */}
          <div className="px-5 py-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Výchozí vedoucí zakázky</span>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Automaticky přiřazen při vytvoření zakázky</p>
              <select
                value={defaultVedouciId}
                onChange={e => setDefaultVedouciId(e.target.value)}
                className="mt-2 w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value="">— Nevybráno —</option>
                {users.filter(u => u.aktivni && resolvePermissions(u.role, u.permissions).zakazkySchvalovani).map(u => (
                  <option key={u.id} value={u.id}>{u.jmeno} ({u.email})</option>
                ))}
              </select>
            </label>
          </div>

          {/* Auto-assign */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Automaticky přiřadit zakázku vedoucímu při ÚSPĚCH OP</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Zakázka bude mít automaticky nastavena vedoucího při vytvoření z OP</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoAssign(!autoAssign)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${autoAssign ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoAssign ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Auto vyúčtování */}
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Automaticky vytvořit vyúčtování po schválení PP</p>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Po schválení předávacího protokolu se automaticky vytvoří návrh vyúčtování</p>
            </div>
            <button
              type="button"
              onClick={() => setAutoVyuctovani(!autoVyuctovani)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ml-4 ${autoVyuctovani ? 'bg-green-500' : 'bg-gray-200 dark:bg-slate-600'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${autoVyuctovani ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Prefix */}
          <div className="px-5 py-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Prefix čísla zakázky</span>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Prázdné = výchozí formát (např. 26-124). S prefixem: PREFIX-26-124</p>
              <input
                type="text"
                value={prefix}
                onChange={e => setPrefix(e.target.value)}
                placeholder="např. ZAK"
                maxLength={10}
                className="mt-2 w-full border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm placeholder-gray-400 dark:placeholder-slate-500"
                style={{ fontSize: 16 }}
              />
            </label>
          </div>

          {/* Výchozí DPH */}
          <div className="px-5 py-4">
            <label className="block">
              <span className="text-sm font-medium text-gray-900 dark:text-white">Výchozí sazba DPH pro položky zakázky / vyúčtování</span>
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Nové položky se přidají s touto sazbou DPH</p>
              <select
                value={defaultDph}
                onChange={e => setDefaultDph(Number(e.target.value))}
                className="mt-2 border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg px-3 py-2 text-sm"
              >
                <option value={0}>0 %</option>
                <option value={12}>12 %</option>
                <option value={21}>21 %</option>
              </select>
            </label>
          </div>

          {/* Save button */}
          <div className="px-5 py-4 flex justify-end">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white font-medium text-sm px-5 py-2 rounded-lg disabled:opacity-50 transition-colors"
            >
              {saving ? 'Ukládám…' : 'Uložit nastavení'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
