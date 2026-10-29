'use client'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'

export default function SouhlasKlient({ params }: { params: Record<string, string> }) {
  const [odesila, setOdesila] = useState<'povolit' | 'zamitnout' | null>(null)
  const [chyba, setChyba] = useState('')

  async function rozhodni(povolit: boolean) {
    setOdesila(povolit ? 'povolit' : 'zamitnout')
    setChyba('')
    try {
      const res = await fetch('/api/oauth/authorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ params, povolit }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.redirect !== 'string') {
        setChyba(data.error ?? 'Připojení se nezdařilo.')
        setOdesila(null)
        return
      }
      window.location.assign(data.redirect)
    } catch {
      setChyba('Připojení se nezdařilo.')
      setOdesila(null)
    }
  }

  return (
    <div className="space-y-3">
      {chyba && <p className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
      <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
        <Button variant="secondary" onClick={() => rozhodni(false)} disabled={!!odesila} loading={odesila === 'zamitnout'}>
          Zamítnout
        </Button>
        <Button onClick={() => rozhodni(true)} disabled={!!odesila} loading={odesila === 'povolit'}>
          Povolit přístup
        </Button>
      </div>
    </div>
  )
}
