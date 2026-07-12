'use client'
import { useState } from 'react'

interface ExtData {
  nazev: string
  label: string
  popis: string
  icon: React.ReactNode
  aktivni: boolean
  apiKlic: string
  id: string | null
}

export default function ExtensionsManager({ extensions: init }: { extensions: ExtData[] }) {
  const [extensions, setExtensions] = useState(init)
  const [saving, setSaving] = useState<string | null>(null)
  const [apiKeys, setApiKeys] = useState<Record<string, string>>(
    Object.fromEntries(init.map(e => [e.nazev, e.apiKlic]))
  )

  async function toggle(ext: ExtData) {
    setSaving(ext.nazev)
    try {
      const res = await fetch('/api/settings/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: ext.nazev, aktivni: !ext.aktivni, apiKlic: apiKeys[ext.nazev] }),
      })
      if (res.ok) {
        setExtensions(prev => prev.map(e => e.nazev === ext.nazev ? { ...e, aktivni: !e.aktivni } : e))
      }
    } finally { setSaving(null) }
  }

  async function saveKey(ext: ExtData) {
    setSaving(ext.nazev)
    try {
      await fetch('/api/settings/extensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev: ext.nazev, aktivni: ext.aktivni, apiKlic: apiKeys[ext.nazev] }),
      })
    } finally { setSaving(null) }
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {extensions.map(ext => (
        <div key={ext.nazev} className={`bg-white dark:bg-slate-800 rounded-xl border p-5 transition-all ${ext.aktivni ? 'border-blue-300 dark:border-blue-700' : 'border-gray-200 dark:border-slate-700'}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="text-2xl">{ext.icon}</span>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white">{ext.label}</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">{ext.popis}</p>
              </div>
            </div>
            <button
              onClick={() => toggle(ext)}
              disabled={saving === ext.nazev}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${ext.aktivni ? 'bg-primary' : 'bg-gray-200 dark:bg-slate-600'} disabled:opacity-50`}
            >
              <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${ext.aktivni ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>
          {ext.aktivni && (
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-slate-700">
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">API klíč</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={apiKeys[ext.nazev] ?? ''}
                  onChange={e => setApiKeys(k => ({ ...k, [ext.nazev]: e.target.value }))}
                  placeholder="Zadejte API klíč…"
                  className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={() => saveKey(ext)}
                  disabled={saving === ext.nazev}
                  className="px-3 py-1.5 text-sm text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
                >
                  Uložit
                </button>
              </div>
            </div>
          )}
          <div className="mt-3">
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${ext.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
              {ext.aktivni ? 'Aktivní' : 'Neaktivní'}
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
