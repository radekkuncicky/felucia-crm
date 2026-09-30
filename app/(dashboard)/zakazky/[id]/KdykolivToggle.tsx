'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'

interface Props {
  zakazkaId: string
  kdykoliv: boolean
  canEdit: boolean
}

const TITLE = 'Zakázku lze udělat kdykoliv — výplň volného místa ve výjezdu'

function ClockIcon({ className }: { className: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

/** Přepínač příznaku „Kdykoliv" v hlavičce zakázky. Optimistický, při chybě se vrátí. */
export default function KdykolivToggle({ zakazkaId, kdykoliv, canEdit }: Props) {
  const router = useRouter()
  const [value, setValue] = useState(kdykoliv)
  const [saving, setSaving] = useState(false)

  async function toggle() {
    const next = !value
    setValue(next)
    setSaving(true)
    try {
      const res = await api.patch(`/api/zakazky/${zakazkaId}`, { kdykoliv: next }, {
        errorMessage: 'Příznak „Kdykoliv" se nepodařilo uložit.',
      })
      if (!res.ok) setValue(!next)
      else router.refresh()
    } finally {
      setSaving(false)
    }
  }

  if (!canEdit) {
    if (!value) return null
    return (
      <span title={TITLE} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
        <ClockIcon className="w-3.5 h-3.5" />
        Kdykoliv
      </span>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={value}
      data-compact
      onClick={toggle}
      disabled={saving}
      title={TITLE}
      className={`hit-area inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border font-medium transition-colors disabled:opacity-60 ${
        value
          ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/50'
          : 'bg-transparent text-gray-500 dark:text-slate-400 border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700'
      }`}
    >
      <ClockIcon className="w-3.5 h-3.5" />
      Kdykoliv
      <span className={`w-1.5 h-1.5 rounded-full ${value ? 'bg-amber-500' : 'bg-gray-300 dark:bg-slate-600'}`} aria-hidden />
    </button>
  )
}
