'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { StavDealu, Technologie } from '@prisma/client'
import { techLabels, techColors } from '@/lib/constants'
import InlineStatusBadge from './InlineStatusBadge'

interface DealPreview {
  id: string
  kod: string | null
  predmet: string | null
  stav: StavDealu
  technologie: Technologie
  dphSazba: number
  konecnaCena: number
  konecnaCenaSDph: number
  hodnotaZalohy: number | null
  poznamky: string | null
  vytvoreno: string
  terminRealizace: string | null
  client: { id: string; jmeno: string; prijmeni: string; telefon: string | null; email: string | null }
  user: { id: string; jmeno: string } | null
  activities: { id: string; typ: string; popis: string; datum: string; stav: string }[]
  quotes: { id: string; nazev: string; kod: string | null; aktivni: boolean; suma: number }[]
}

interface Props {
  dealId: string | null
  onClose: () => void
  onStavChange?: (dealId: string, newStav: StavDealu) => void
}

const ACT_ICONS: Record<string, string> = {
  HOVOR: '📞', EMAIL: '✉️', SCHUZKA: '🤝', POZNAMKA: '📝', UKOL: '✅',
}

function fmtKc(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} M Kč`
  if (n >= 1_000) return `${Math.round(n / 1_000)} tis. Kč`
  return `${n.toLocaleString('cs-CZ')} Kč`
}

export default function DealSlideOver({ dealId, onClose, onStavChange }: Props) {
  const [data, setData] = useState<DealPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  const fetchDeal = useCallback(async (id: string) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/deals/${id}/preview`)
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (dealId) {
      setData(null)
      fetchDeal(dealId)
      requestAnimationFrame(() => setVisible(true))
    } else {
      setVisible(false)
    }
  }, [dealId, fetchDeal])

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (dealId) document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [dealId, onClose])

  if (!dealId) return null

  const cenaSDph = data ? data.konecnaCenaSDph : 0

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 transition-opacity duration-250"
        style={{ background: 'rgba(0,0,0,0.2)', opacity: visible ? 1 : 0 }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className="fixed right-0 top-0 h-full z-50 flex flex-col bg-white dark:bg-slate-900 border-l border-[#C8E6C9] dark:border-slate-700 shadow-2xl transition-transform duration-250 ease-out"
        style={{
          width: 'min(480px, 100vw)',
          transform: visible ? 'translateX(0)' : 'translateX(100%)',
        }}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-gray-100 dark:border-slate-800 flex-shrink-0">
          <div className="flex-1 min-w-0">
            {data?.kod && (
              <span className="font-mono text-xs font-semibold text-[#4CAF50] bg-[#E8F5E9] dark:bg-[rgba(76,175,80,0.12)] px-2 py-0.5 rounded">
                {data.kod}
              </span>
            )}
            <h2 className="text-base font-bold text-gray-900 dark:text-white mt-1 leading-tight" style={{ fontFamily: "'Space Grotesk', sans-serif" }}>
              {loading ? <span className="text-gray-300 dark:text-slate-600">Načítám…</span> : (data?.predmet ?? 'Bez předmětu')}
            </h2>
            {data && (
              <div className="mt-2">
                <InlineStatusBadge
                  dealId={data.id}
                  stav={data.stav}
                  onChange={newStav => {
                    setData(d => d ? { ...d, stav: newStav } : d)
                    onStavChange?.(data.id, newStav)
                  }}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
            {data && (
              <Link
                href={`/deals/${data.id}`}
                className="flex items-center gap-1 text-xs font-medium text-[#4CAF50] hover:text-[#2E7D32] border border-[#C8E6C9] hover:border-[#4CAF50] px-2.5 py-1.5 rounded-lg transition-colors whitespace-nowrap"
              >
                Otevřít detail
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            )}
            <button
              onClick={onClose}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="w-8 h-8 border-2 border-[#4CAF50] border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {data && (
            <>
              {/* Basic info */}
              <section>
                <h3 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-semibold mb-3">Základní informace</h3>
                <div className="space-y-2.5">
                  <InfoRow icon="👤" label="Klient">
                    <Link href={`/clients/${data.client.id}`} className="text-sm font-medium text-primary dark:text-primary-light hover:underline">
                      {data.client.jmeno} {data.client.prijmeni}
                    </Link>
                    {data.client.telefon && (
                      <a href={`tel:${data.client.telefon}`} className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 block">{data.client.telefon}</a>
                    )}
                    {data.client.email && (
                      <a href={`mailto:${data.client.email}`} className="text-xs text-gray-500 dark:text-slate-400 hover:text-blue-600 block truncate">{data.client.email}</a>
                    )}
                  </InfoRow>

                  <InfoRow icon="🔧" label="Technologie">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${techColors[data.technologie]}`}>
                      {techLabels[data.technologie]}
                    </span>
                  </InfoRow>

                  {cenaSDph > 0 && (
                    <InfoRow icon="💰" label="Cena vč. DPH">
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtKc(cenaSDph)}</span>
                      <span className="text-xs text-gray-400 ml-1">({fmtKc(data.konecnaCena)} bez DPH)</span>
                    </InfoRow>
                  )}

                  {data.user && (
                    <InfoRow icon="👤" label="Přiřazeno">
                      <span className="text-sm text-gray-700 dark:text-slate-300">{data.user.jmeno}</span>
                    </InfoRow>
                  )}

                  <InfoRow icon="📅" label="Otevřeno">
                    <span className="text-sm text-gray-600 dark:text-slate-400">
                      {new Date(data.vytvoreno).toLocaleDateString('cs-CZ')}
                    </span>
                  </InfoRow>

                  {data.terminRealizace && (
                    <InfoRow icon="🔨" label="Realizace">
                      <span className="text-sm text-orange-600 dark:text-orange-400">
                        {new Date(data.terminRealizace).toLocaleDateString('cs-CZ')}
                      </span>
                    </InfoRow>
                  )}
                </div>
              </section>

              {/* Activities */}
              {data.activities.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-semibold">Poslední aktivity</h3>
                    <Link href={`/deals/${data.id}?tab=aktivity`} className="text-xs text-[#4CAF50] hover:underline">
                      Zobrazit všechny →
                    </Link>
                  </div>
                  <div className="space-y-2">
                    {data.activities.map(act => (
                      <div key={act.id} className={`flex items-start gap-2.5 p-2.5 rounded-xl ${act.stav === 'DOKONCENA' ? 'opacity-50' : 'bg-gray-50 dark:bg-slate-800/60'}`}>
                        <span className="text-base flex-shrink-0">{ACT_ICONS[act.typ] ?? '•'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 dark:text-slate-200 line-clamp-2">{act.popis}</p>
                          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                            {new Date(act.datum).toLocaleDateString('cs-CZ')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Quotes */}
              {data.quotes.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-semibold">Nabídky</h3>
                    <Link href={`/deals/${data.id}?tab=nabidky`} className="text-xs text-[#4CAF50] hover:underline">
                      Otevřít nabídky →
                    </Link>
                  </div>
                  <div className="space-y-1.5">
                    {data.quotes.map(q => (
                      <div key={q.id} className="flex items-center justify-between gap-3 p-2.5 bg-gray-50 dark:bg-slate-800/60 rounded-xl">
                        <div className="flex items-center gap-2 min-w-0">
                          {q.aktivni && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />}
                          <span className="text-sm text-gray-800 dark:text-slate-200 truncate">{q.nazev}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700 dark:text-slate-300 flex-shrink-0">
                          {q.suma > 0 ? fmtKc(q.suma) : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Notes */}
              {data.poznamky && (
                <section>
                  <h3 className="text-[10px] uppercase tracking-widest text-gray-400 dark:text-slate-500 font-semibold mb-2">Poznámka</h3>
                  <p className="text-sm text-gray-700 dark:text-slate-300 bg-gray-50 dark:bg-slate-800/60 rounded-xl p-3 whitespace-pre-wrap">{data.poznamky}</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {data && (
          <div className="flex items-center gap-2 px-5 py-3 border-t border-gray-100 dark:border-slate-800 flex-shrink-0">
            <Link
              href={`/deals/${data.id}?tab=aktivity`}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-200 dark:border-slate-700 hover:border-[#4CAF50] hover:text-[#4CAF50] py-2 rounded-xl transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M12 4v16m8-8H4" />
              </svg>
              Přidat aktivitu
            </Link>
            <Link
              href={`/deals/${data.id}`}
              className="flex-1 flex items-center justify-center gap-2 text-sm font-medium text-white bg-[#4CAF50] hover:bg-[#43A047] py-2 rounded-xl transition-colors"
            >
              Otevřít detail
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </div>
    </>
  )
}

function InfoRow({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="text-base w-5 text-center flex-shrink-0 mt-0.5">{icon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 dark:text-slate-500 font-semibold mb-0.5">{label}</p>
        <div>{children}</div>
      </div>
    </div>
  )
}
