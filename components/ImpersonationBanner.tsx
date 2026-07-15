'use client'

import { useState } from 'react'

interface Props {
  orgNazev: string
  superAdminJmeno: string
}

export default function ImpersonationBanner({ orgNazev, superAdminJmeno }: Props) {
  const [leaving, setLeaving] = useState(false)

  const stopImpersonation = async () => {
    setLeaving(true)
    await fetch('/api/superadmin/impersonate', { method: 'DELETE' })
    window.location.href = '/superadmin/organizations'
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-red-600 text-white px-4 py-2 flex items-center justify-between shadow-lg">
      <div className="flex items-center gap-2 text-sm">
        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
        <span>
          <strong>{superAdminJmeno}</strong> prohlíží jako organizace <strong>{orgNazev}</strong>
        </span>
      </div>
      <button
        onClick={stopImpersonation}
        disabled={leaving}
        className="flex items-center gap-1.5 px-3 py-1 bg-red-800 hover:bg-red-900 rounded text-sm font-medium transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
        {leaving ? 'Ukončuji...' : 'Ukončit zobrazení'}
      </button>
    </div>
  )
}
