'use client'

import { useState } from 'react'

interface SystemSettings {
  id: string
  maintenanceMode: boolean
  maintenanceMessage: string
  announcementText: string
  announcementActive: boolean
  announcementColor: string
}

interface Props {
  settings: SystemSettings
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${checked ? 'bg-[#FFC93C]' : 'bg-gray-600'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  )
}

export default function SystemClient({ settings: initial }: Props) {
  const [settings, setSettings] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const save = async () => {
    setSaving(true)
    setSaved(false)
    await fetch('/api/superadmin/system', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const update = (key: keyof SystemSettings, value: unknown) => {
    setSettings(prev => ({ ...prev, [key]: value }))
  }

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Systém</h1>
          <p className="text-gray-400 mt-1">Globální nastavení platformy</p>
        </div>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
        >
          {saved ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
            </svg>
          )}
          {saving ? 'Ukládám...' : saved ? 'Uloženo' : 'Uložit změny'}
        </button>
      </div>

      {/* Maintenance mode */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6 mb-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Režim údržby
        </h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-300">Aktivovat maintenance mode</p>
            <p className="text-xs text-gray-500 mt-0.5">Všichni uživatelé budou přesměrováni na stránku údržby</p>
          </div>
          <Toggle checked={settings.maintenanceMode} onChange={v => update('maintenanceMode', v)} />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Zpráva pro uživatele</label>
          <textarea
            value={settings.maintenanceMessage}
            onChange={e => update('maintenanceMessage', e.target.value)}
            rows={2}
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none"
          />
        </div>
      </div>

      {/* Announcement banner */}
      <div className="bg-gray-900 rounded-xl border border-gray-800 p-6">
        <h2 className="font-semibold text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
          </svg>
          Oznamovací banner
        </h2>
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-gray-300">Aktivovat banner</p>
            <p className="text-xs text-gray-500 mt-0.5">Zobrazit oznámení všem přihlášeným uživatelům</p>
          </div>
          <Toggle checked={settings.announcementActive} onChange={v => update('announcementActive', v)} />
        </div>
        <div className="mb-3">
          <label className="block text-xs text-gray-400 mb-1.5">Text oznámení</label>
          <textarea
            value={settings.announcementText}
            onChange={e => update('announcementText', e.target.value)}
            rows={2}
            placeholder="Napište text oznámení..."
            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Barva banneru</label>
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={settings.announcementColor}
              onChange={e => update('announcementColor', e.target.value)}
              className="w-10 h-10 rounded border border-gray-700 cursor-pointer bg-transparent"
            />
            <span className="text-sm text-gray-400 font-mono">{settings.announcementColor}</span>
          </div>
        </div>

        {/* Preview */}
        {settings.announcementText && settings.announcementActive && (
          <div className="mt-4">
            <p className="text-xs text-gray-400 mb-2">Náhled:</p>
            <div
              className="rounded-lg px-4 py-2 text-sm font-medium"
              style={{ backgroundColor: settings.announcementColor, color: '#000' }}
            >
              {settings.announcementText}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
