'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavigateButton } from '@/components/NavigateButton'

interface Props {
  zakazkaId: string
  mistoStavby: string | null
  klientAdresa: string
  canEdit: boolean
}

export default function MistoStavbyEdit({ zakazkaId, mistoStavby, klientAdresa, canEdit }: Props) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(mistoStavby ?? '')
  const [saving, setSaving] = useState(false)

  async function save(next: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mistoStavby: next }),
      })
      if (res.ok) {
        setEditing(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  if (editing) {
    return (
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <svg className="w-4 h-4 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <input
          type="text"
          value={value}
          onChange={e => setValue(e.target.value)}
          placeholder="Adresa stavby / místo instalace"
          autoFocus
          style={{ fontSize: 16 }}
          className="border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary min-w-[220px]"
        />
        {klientAdresa && (
          <button
            type="button"
            onClick={() => setValue(klientAdresa)}
            disabled={saving}
            title="Vyplnit adresou klienta"
            className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
          >
            Převzít z klienta
          </button>
        )}
        <button
          type="button"
          onClick={() => save(value.trim())}
          disabled={saving}
          className="text-xs px-2 py-1 rounded-lg font-medium bg-primary hover:bg-primary-hover text-white disabled:opacity-50"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        <button
          type="button"
          onClick={() => { setValue(mistoStavby ?? ''); setEditing(false) }}
          disabled={saving}
          className="text-xs px-2 py-1 rounded-lg text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          Zrušit
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-2">
      <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">Místo stavby:</span>
      {mistoStavby ? (
        <>
          <span className="text-xs text-gray-700 dark:text-slate-300">{mistoStavby}</span>
          <NavigateButton adresa={mistoStavby} size="xs" />
        </>
      ) : (
        <span className="text-xs text-gray-400 dark:text-slate-500 italic">neuvedeno</span>
      )}
      {canEdit && (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="text-xs px-2 py-0.5 rounded-lg border border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700"
        >
          {mistoStavby ? 'Upravit' : '+ Doplnit'}
        </button>
      )}
    </div>
  )
}
