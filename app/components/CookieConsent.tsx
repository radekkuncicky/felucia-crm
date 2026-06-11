'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent')
    if (!consent) setVisible(true)
  }, [])

  function accept() {
    localStorage.setItem('cookie_consent', 'accepted')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '16px',
        left: '50%',
        transform: 'translateX(-50%)',
        width: 'calc(100% - 32px)',
        maxWidth: '600px',
        zIndex: 9999,
      }}
    >
      <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-2xl shadow-2xl px-5 py-4 flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-gray-700 dark:text-slate-300 leading-relaxed">
            Tento web používá pouze nezbytné funkční cookies pro přihlášení. Žádné sledovací ani reklamní cookies nepoužíváme.{' '}
            <Link href="/privacy" className="text-primary dark:text-primary-light underline underline-offset-2 hover:text-blue-700">
              Více info
            </Link>
          </p>
        </div>
        <button
          onClick={accept}
          className="shrink-0 px-4 py-2 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl transition-colors whitespace-nowrap"
        >
          Rozumím
        </button>
      </div>
    </div>
  )
}
