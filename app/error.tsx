'use client'

import { useEffect } from 'react'

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('App error:', error)
  }, [error])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4 bg-fel-bg dark:bg-fel-deepnight">
      <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-950/40 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-xl font-bold text-gray-900 dark:text-white mb-1">Něco se pokazilo</h1>
      <p className="text-sm text-gray-500 dark:text-slate-400 mb-6 max-w-md">
        Došlo k neočekávané chybě. Zkuste stránku načíst znovu.
      </p>
      {error.digest && (
        <p className="text-xs text-gray-400 dark:text-slate-500 mb-4 font-mono">Kód chyby: {error.digest}</p>
      )}
      <button
        onClick={reset}
        className="bg-fel-green hover:bg-fel-green-dark text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
      >
        Zkusit znovu
      </button>
    </div>
  )
}
