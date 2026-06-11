'use client'

import { useState } from 'react'

export default function CalendarSubscribeCard({
  webcalUrl,
  subscribeUrl,
}: {
  webcalUrl: string
  subscribeUrl: string
}) {
  const [copied, setCopied] = useState<'webcal' | 'https' | null>(null)

  function copy(url: string, which: 'webcal' | 'https') {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    })
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
      <div className="flex items-center gap-2 mb-1">
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" strokeWidth="1.8" />
          <line x1="16" y1="2" x2="16" y2="6" strokeWidth="1.8" />
          <line x1="8" y1="2" x2="8" y2="6" strokeWidth="1.8" />
          <line x1="3" y1="10" x2="21" y2="10" strokeWidth="1.8" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Synchronizace s kalendářem</h3>
      </div>
      <p className="text-xs text-gray-500 dark:text-slate-400 mb-4">
        Přidejte svůj osobní kalendář aktivit do Google, Apple nebo Outlook. Aktualizuje se automaticky.
      </p>

      <div className="space-y-2.5">
        {/* webcal — iOS/macOS */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">iOS / macOS / Apple Calendar</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 min-w-0 overflow-hidden">
              <span className="text-xs font-mono text-gray-500 dark:text-slate-400 truncate">{webcalUrl}</span>
            </div>
            <a
              href={webcalUrl}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-lg transition-colors"
            >
              Přihlásit
            </a>
            <button
              onClick={() => copy(webcalUrl, 'webcal')}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-lg transition-colors"
            >
              {copied === 'webcal' ? '✓ Zkopírováno' : 'Kopírovat'}
            </button>
          </div>
        </div>

        {/* https — Google/Outlook */}
        <div>
          <p className="text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Google Calendar / Outlook</p>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-gray-50 dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2 min-w-0 overflow-hidden">
              <span className="text-xs font-mono text-gray-500 dark:text-slate-400 truncate">{subscribeUrl}</span>
            </div>
            <button
              onClick={() => copy(subscribeUrl, 'https')}
              className="flex-shrink-0 px-3 py-2 text-xs font-medium bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 text-gray-700 dark:text-slate-300 rounded-lg transition-colors"
            >
              {copied === 'https' ? '✓ Zkopírováno' : 'Kopírovat'}
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">
        Google Calendar: <span className="font-medium">Další kalendáře → Z URL</span> · Outlook: <span className="font-medium">Přidat kalendář → Z internetu</span>
      </p>
    </div>
  )
}
