'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import SodTemplateEditor from '@/components/SodTemplateEditor'

interface Props {
  sodId: string
  cislo: string
  initialText: string
}

export default function SodEditClient({ sodId, cislo, initialText }: Props) {
  const router = useRouter()
  const [text, setText] = useState(initialText)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [showPlaceholders, setShowPlaceholders] = useState(false)

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/sod/${sodId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ textSmlouvy: text }),
      })
      if (res.ok) {
        router.push(`/sod/${sodId}`)
      } else {
        const d = await res.json()
        setError(d.error ?? 'Chyba při ukládání')
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-4">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-1">
            <Link
              href={`/sod/${sodId}`}
              className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-blue-600"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Zpět na detail
            </Link>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">Upravit smlouvu {cislo}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowPlaceholders(p => !p)}
              className={`text-sm border px-3 py-2 rounded-lg transition-colors ${
                showPlaceholders
                  ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300'
                  : 'text-gray-600 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              Symboly
            </button>
            <Link
              href={`/sod/${sodId}`}
              className="text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
            >
              Zrušit
            </Link>
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-sm font-medium text-white bg-primary hover:bg-primary-hover px-4 py-2 rounded-lg disabled:opacity-50"
            >
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400 mt-2">{error}</p>}
      </div>

      <SodTemplateEditor
        content={text}
        onChange={setText}
        showPlaceholders={showPlaceholders}
        minHeight="72vh"
      />
    </div>
  )
}
