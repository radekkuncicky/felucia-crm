'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/format'
import { techLabels, zamereniStavLabels, zamereniFotoTagLabels } from '@/lib/constants'
import { NavigateButton } from '@/components/NavigateButton'

interface Foto {
  id: string
  url: string
  tag: string
  popis: string | null
}

interface Sekce {
  nazev: string
  otazky: { popisek: string; hodnota: string }[]
}

interface ZamereniItem {
  id: string
  typ: string
  stav: string
  datum: string
  autor: string | null
  adresa: string | null
  sekce: Sekce[]
  fotky: Foto[]
}

interface Props {
  zamereni: ZamereniItem[]
}

export default function ZamereniTab({ zamereni }: Props) {
  const [aktivniId, setAktivniId] = useState(zamereni[0]?.id ?? null)
  const [lightbox, setLightbox] = useState<Foto | null>(null)

  if (zamereni.length === 0) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-10 text-center">
        <p className="text-sm text-gray-400 dark:text-slate-500">
          Zatím žádné zaměření — vzniká v mobilní appce Felucia Sales na tomto případu.
        </p>
      </div>
    )
  }

  const aktivni = zamereni.find(z => z.id === aktivniId) ?? zamereni[0]

  return (
    <div className="space-y-4">
      {zamereni.length > 1 && (
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {zamereni.map(z => (
            <button
              key={z.id}
              onClick={() => setAktivniId(z.id)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                z.id === aktivni.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-primary-light'
              }`}
            >
              {formatDate(z.datum)}
            </button>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">
              {techLabels[aktivni.typ as keyof typeof techLabels] ?? aktivni.typ}
            </p>
            <p className="text-sm text-gray-500 dark:text-slate-400">
              {formatDate(aktivni.datum)}
              {aktivni.autor ? ` · ${aktivni.autor}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {aktivni.adresa && <NavigateButton adresa={aktivni.adresa} size="xs" />}
            <span
              className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                aktivni.stav === 'UZAVRENE'
                  ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300'
              }`}
            >
              {zamereniStavLabels[aktivni.stav] ?? aktivni.stav}
            </span>
          </div>
        </div>
      </div>

      {aktivni.sekce.length === 0 ? (
        <p className="text-sm text-gray-400 dark:text-slate-500 px-1">Zatím žádné vyplněné odpovědi.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {aktivni.sekce.map(sekce => (
            <div key={sekce.nazev} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-3">{sekce.nazev}</p>
              <dl className="space-y-2">
                {sekce.otazky.map(o => (
                  <div key={o.popisek} className="flex items-start justify-between gap-3 text-sm">
                    <dt className="text-gray-500 dark:text-slate-400">{o.popisek}</dt>
                    <dd className="text-gray-900 dark:text-white font-medium text-right">{o.hodnota}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-3">
          Fotky ({aktivni.fotky.length})
        </p>
        {aktivni.fotky.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-slate-500">Žádné fotky.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {aktivni.fotky.map(f => (
              <button key={f.id} onClick={() => setLightbox(f)} className="text-left group">
                <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-slate-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={zamereniFotoTagLabels[f.tag] ?? f.tag} className="w-full h-full object-cover group-hover:opacity-80 transition-opacity" />
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 truncate">{zamereniFotoTagLabels[f.tag] ?? f.tag}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setLightbox(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh] mx-4" onClick={e => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightbox.url} alt={zamereniFotoTagLabels[lightbox.tag] ?? lightbox.tag} className="max-w-full max-h-[85vh] object-contain rounded-lg" />
            <div className="absolute bottom-0 left-0 right-0 px-4 py-2 bg-black/50 rounded-b-lg flex items-center justify-between">
              <p className="text-white text-sm">
                {zamereniFotoTagLabels[lightbox.tag] ?? lightbox.tag}
                {lightbox.popis ? ` — ${lightbox.popis}` : ''}
              </p>
              <button onClick={() => setLightbox(null)} className="text-white hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
