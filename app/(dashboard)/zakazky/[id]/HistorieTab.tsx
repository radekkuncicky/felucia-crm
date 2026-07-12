'use client'

import { useState, useRef, useEffect } from 'react'
import { formatDateTime } from '@/lib/format'

interface Komentar {
  id: string
  text: string
  vytvoreno: string
  user: { id: string; jmeno: string; role: string }
}

interface AuditEntry {
  id: string
  typAkce: string
  typZaznamu: string
  zaznamNazev: string
  zmeny: Record<string, unknown>
  vytvoreno: string
  userJmeno: string | null
}

interface Props {
  zakazkaId: string
  komentare: Komentar[]
  currentUserId: string
  aktivity: AuditEntry[]
}

function formatZmeny(zmeny: Record<string, unknown>): string {
  if (zmeny.stavPred && zmeny.stavPo) return `Stav: ${zmeny.stavPred} → ${zmeny.stavPo}`
  if (zmeny.stav) return `Stav: ${zmeny.stav}`
  if (zmeny.storno) return `Storno: ${zmeny.duvod ?? ''}`
  return JSON.stringify(zmeny)
}

export default function HistorieTab({ zakazkaId, komentare: initialKomentare, currentUserId, aktivity }: Props) {
  const [view, setView] = useState<'komentare' | 'aktivita'>('komentare')
  const [komentare, setKomentare] = useState(initialKomentare)
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (view === 'komentare') bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [komentare, view])

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
      {/* Toggle header */}
      <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-700 flex items-center gap-2">
        <button
          onClick={() => setView('komentare')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            view === 'komentare'
              ? 'bg-[#1B5E20] text-white'
              : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          Komentáře ({komentare.length})
        </button>
        <button
          onClick={() => setView('aktivita')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            view === 'aktivita'
              ? 'bg-[#1B5E20] text-white'
              : 'text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'
          }`}
        >
          Audit log ({aktivity.length})
        </button>
      </div>

      {view === 'komentare' ? (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ maxHeight: 500 }}>
            {komentare.length === 0 ? (
              <p className="text-center text-sm text-gray-400 dark:text-slate-500 py-6">Zatím žádné komentáře</p>
            ) : (
              komentare.map(k => {
                const isOwn = k.user.id === currentUserId
                return (
                  <div key={k.id} className={`flex gap-3 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isOwn ? 'bg-[#1B5E20] text-white' : 'bg-gray-200 dark:bg-slate-600 text-gray-700 dark:text-slate-300'
                    }`}>
                      {k.user.jmeno.charAt(0).toUpperCase()}
                    </div>
                    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
                      <div className={`rounded-2xl px-4 py-2.5 text-sm ${
                        isOwn
                          ? 'bg-[#1B5E20] text-white rounded-tr-sm'
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
          <div className="border-t border-gray-200 dark:border-slate-700 px-4 py-3">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="text"
                value={text}
                onChange={e => setText(e.target.value)}
                placeholder="Napište komentář…"
                style={{ fontSize: 16 }}
                className="flex-1 border border-gray-300 dark:border-slate-600 rounded-xl px-4 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20]"
              />
              <button
                type="submit"
                disabled={loading || !text.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-[#1B5E20] hover:bg-green-800 rounded-xl disabled:opacity-50 min-h-[44px]"
              >
                {loading ? '…' : 'Odeslat'}
              </button>
            </form>
          </div>
        </>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {aktivity.length === 0 ? (
            <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Žádná aktivita</div>
          ) : (
            <div className="px-5 py-4 space-y-4">
              {aktivity.map((a, i) => (
                <div key={a.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-700 flex items-center justify-center text-sm flex-shrink-0">
                      {a.typZaznamu === 'Zakazka' ? '📋' : a.typZaznamu === 'ZakazkaPolozka' ? '📦' : '📝'}
                    </div>
                    {i < aktivity.length - 1 && <div className="w-0.5 flex-1 bg-gray-100 dark:bg-slate-700 mt-2" />}
                  </div>
                  <div className="pb-4 min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {a.typZaznamu}: <span className="text-gray-600 dark:text-slate-400">{a.zaznamNazev}</span>
                      </p>
                      <span className="text-xs text-gray-400 dark:text-slate-500 flex-shrink-0">
                        {formatDateTime(a.vytvoreno)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{formatZmeny(a.zmeny)}</p>
                    {a.userJmeno && <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">· {a.userJmeno}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
