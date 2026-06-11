'use client'

import { useEffect } from 'react'
import * as Sentry from '@sentry/nextjs'

// Zachytává chyby v root layoutu — musí renderovat vlastní <html>/<body>
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    Sentry.captureException(error)
    console.error('Global error:', error)
  }, [error])

  return (
    <html lang="cs">
      <body>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', textAlign: 'center', padding: '0 16px', fontFamily: 'sans-serif' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Něco se pokazilo</h1>
          <p style={{ fontSize: 14, color: '#6b7280', marginBottom: 24 }}>
            Došlo k neočekávané chybě. Zkuste stránku načíst znovu.
          </p>
          {error.digest && (
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16, fontFamily: 'monospace' }}>Kód chyby: {error.digest}</p>
          )}
          <button
            onClick={reset}
            style={{ background: '#16a34a', color: '#fff', fontSize: 14, fontWeight: 500, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
          >
            Zkusit znovu
          </button>
        </div>
      </body>
    </html>
  )
}
