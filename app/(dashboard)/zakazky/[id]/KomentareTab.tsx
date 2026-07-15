'use client'

import { useState, useRef, useEffect } from 'react'
import { formatDateTime } from '@/lib/format'

interface Komentar {
  id: string
  text: string
  vytvoreno: string
  user: { id: string; jmeno: string; role: string }
}

interface Props {
  zakazkaId: string
  komentare: Komentar[]
  currentUserId: string
}

export default function KomentareTab({ zakazkaId, komentare: initialKomentare, currentUserId }: Props) {
  const [komentare, setKomentare] = useState(initialKomentare)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [komentare])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/komentare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const k = await res.json()
        setKomentare(prev => [...prev, k])
        setText('')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 flex flex-col" style={{ minHeight: 400 }}>
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white">Komentáře ({komentare.length})</h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: 500 }}>
        {komentare.length === 0 ? (
          <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-6">Zatím žádné komentáře</p>
        ) : (
          komentare.map(k => {
            const isOwn = k.user.id === currentUserId
            return (
              <div key={k.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                  isOwn ? 'bg-blue-500 text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
                }`}>
                  {k.user.jmeno.charAt(0).toUpperCase()}
                </div>
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                    isOwn
                      ? 'bg-primary text-white rounded-tr-sm'
                      : 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-white rounded-tl-sm'
                  }`}>
                    {k.text}
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 px-1">
                    {k.user.jmeno} · {formatDateTime(k.vytvoreno)}
                  </p>
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 dark:border-slate-700 px-4 py-3">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Napište komentář…"
            className="flex-1 border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          />
          <button
            type="submit"
            disabled={loading || !text.trim()}
            className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-50"
          >
            {loading ? '…' : 'Odeslat'}
          </button>
        </form>
      </div>
    </div>
  )
}
