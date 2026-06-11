'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DealNotesCard({ dealId, poznamky }: { dealId: string; poznamky: string }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(poznamky)
  const [saved, setSaved] = useState(poznamky)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poznamky: value }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      setSaved(value)
      setEditing(false)
      router.refresh()
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setValue(saved)
    setEditing(false)
    setError('')
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300">Poznámky</h3>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-primary dark:text-primary-light hover:underline"
          >
            {saved ? 'Upravit' : 'Přidat poznámku'}
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-2">
          <textarea
            rows={4}
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-500 resize-none"
            placeholder="Napište poznámku…"
          />
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-xs font-medium px-3 py-1.5 rounded-lg"
            >
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
            <button
              onClick={handleCancel}
              className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600"
            >
              Zrušit
            </button>
          </div>
        </div>
      ) : saved ? (
        <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{saved}</p>
      ) : (
        <p className="text-sm text-gray-400 dark:text-slate-500 italic">Žádné poznámky</p>
      )}
    </div>
  )
}
