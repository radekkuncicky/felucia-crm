'use client'

import { useState } from 'react'
import Link from 'next/link'
import { PredavakStav } from '@prisma/client'

const STAV_LABELS: Record<PredavakStav, string> = {
  ROZPRACOVAN: 'Rozpracován',
  PODPISAN: 'Podepsán',
  SCHVALEN: 'Schválen',
  ODMITNUTO: 'Odmítnuto',
}

const STAV_COLORS: Record<PredavakStav, string> = {
  ROZPRACOVAN: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  PODPISAN: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SCHVALEN: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ODMITNUTO: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

interface Predavak {
  id: string
  cislo: string
  stav: PredavakStav
  technikJmeno: string
  vytvoreno: string
  podpisano: string | null
  upravenoPodpisano: boolean
  etapaId: string | null
}

interface EtapaInfo {
  id: string
  cislo: number
  nazev: string | null
  stav: string
}

interface Props {
  zakazkaId: string
  predavaky: Predavak[]
  canCreate: boolean
  canApprove: boolean
  etapy?: EtapaInfo[]
}

export default function PredavakyTab({ zakazkaId, predavaky: initialPredavaky, canCreate, canApprove, etapy = [] }: Props) {
  const [predavaky, setPredavaky] = useState(initialPredavaky)
  const [loading, setLoading] = useState<string | null>(null)
  const [odmitnutiModal, setOdmitnutiModal] = useState<string | null>(null)
  const [odmitnutiDuvod, setOdmitnutiDuvod] = useState('')
  const [chyba, setChyba] = useState<string | null>(null)

  async function handleNovy(etapaId?: string) {
    setLoading('new')
    setChyba(null)
    try {
      const otevrenaEtapa = etapaId ?? (etapy.length > 0
        ? ([...etapy].reverse().find(e => e.stav !== 'PREDANA')?.id ?? null)
        : null)
      const res = await fetch('/api/predavaky', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zakazkaId, etapaId: otevrenaEtapa }),
      })
      if (res.ok) {
        const p = await res.json()
        window.location.href = `/zakazky/${zakazkaId}/predavaky/${p.id}`
      } else {
        const err = await res.json().catch(() => ({}))
        setChyba(err.error ?? 'Nepodařilo se vytvořit protokol')
      }
    } catch {
      setChyba('Chyba připojení, zkuste znovu')
    } finally {
      setLoading(null)
    }
  }

  async function handleSchvalit(predavakId: string) {
    setLoading(predavakId)
    try {
      const res = await fetch(`/api/predavaky/${predavakId}/schvalit`, { method: 'POST' })
      if (res.ok) {
        setPredavaky(prev => prev.map(p => p.id === predavakId ? { ...p, stav: 'SCHVALEN' as PredavakStav } : p))
      }
    } finally {
      setLoading(null)
    }
  }

  async function handleOdmitnout(predavakId: string) {
    if (!odmitnutiDuvod.trim()) return
    setLoading(predavakId)
    try {
      const res = await fetch(`/api/predavaky/${predavakId}/odmitnout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duvod: odmitnutiDuvod }),
      })
      if (res.ok) {
        setPredavaky(prev => prev.map(p => p.id === predavakId ? { ...p, stav: 'ODMITNUTO' as PredavakStav } : p))
        setOdmitnutiModal(null)
        setOdmitnutiDuvod('')
      }
    } finally {
      setLoading(null)
    }
  }

  return (
    <>
      {odmitnutiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Odmítnout protokol</h3>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Důvod odmítnutí *</label>
              <textarea value={odmitnutiDuvod} onChange={e => setOdmitnutiDuvod(e.target.value)} rows={3} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div className="flex gap-3 justify-end">
              <button onClick={() => { setOdmitnutiModal(null); setOdmitnutiDuvod('') }} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={() => handleOdmitnout(odmitnutiModal!)} disabled={!odmitnutiDuvod.trim() || !!loading} className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                Odmítnout
              </button>
            </div>
          </div>
        </div>
      )}

      {chyba && (
        <div className="mb-3 px-4 py-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300 flex items-center justify-between gap-3">
          <span>{chyba}</span>
          <button onClick={() => setChyba(null)} className="text-red-400 hover:text-red-600 flex-shrink-0">✕</button>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Předávací protokoly ({predavaky.length})</h3>
          {canCreate && etapy.length === 0 && (
            <button
              onClick={() => handleNovy()}
              disabled={loading === 'new'}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1B5E20] hover:bg-green-800 px-3 py-2 rounded-lg disabled:opacity-50 transition-colors min-h-[40px]"
            >
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span className="hidden sm:inline">{loading === 'new' ? 'Vytvářím…' : 'Nový protokol'}</span>
              <span className="sm:hidden">{loading === 'new' ? '…' : 'Nový'}</span>
            </button>
          )}
        </div>

        {predavaky.length === 0 && etapy.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Žádné předávací protokoly</div>
        ) : (
          <PredavakyList
            predavaky={predavaky}
            etapy={etapy}
            zakazkaId={zakazkaId}
            canCreate={canCreate}
            canApprove={canApprove}
            loading={loading}
            onNovy={handleNovy}
            onSchvalit={handleSchvalit}
            onOdmitnout={id => setOdmitnutiModal(id)}
          />
        )}
      </div>
    </>
  )
}

function PredavakRow({ p, zakazkaId, canApprove, loading, onSchvalit, onOdmitnout }: {
  p: Predavak; zakazkaId: string; canApprove: boolean; loading: string | null
  onSchvalit: (id: string) => void; onOdmitnout: (id: string) => void
}) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4 flex-wrap">
      <div className="flex items-center gap-3">
        <div>
          <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{p.cislo}</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
            {p.technikJmeno} · {new Date(p.vytvoreno).toLocaleDateString('cs-CZ')}
            {p.podpisano && ` · Podepsán ${new Date(p.podpisano).toLocaleDateString('cs-CZ')}`}
          </p>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[p.stav]}`}>
          {STAV_LABELS[p.stav]}
        </span>
        {p.upravenoPodpisano && p.stav === 'PODPISAN' && (
          <span title="Technik upravil protokol po odeslání" className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            upraveno
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Link href={`/zakazky/${zakazkaId}/predavaky/${p.id}`} className="text-sm text-primary dark:text-primary-light hover:underline font-medium">
          Detail
        </Link>
        {canApprove && p.stav === 'PODPISAN' && (
          <>
            <button onClick={() => onSchvalit(p.id)} disabled={loading === p.id} className="text-xs px-2.5 py-1 font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              Schválit
            </button>
            <button onClick={() => onOdmitnout(p.id)} disabled={!!loading} className="text-xs px-2.5 py-1 font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              Odmítnout
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PredavakyList({ predavaky, etapy, zakazkaId, canCreate, canApprove, loading, onNovy, onSchvalit, onOdmitnout }: {
  predavaky: Predavak[]; etapy: EtapaInfo[]; zakazkaId: string
  canCreate: boolean; canApprove: boolean; loading: string | null
  onNovy: (etapaId?: string) => void
  onSchvalit: (id: string) => void; onOdmitnout: (id: string) => void
}) {
  if (etapy.length === 0) {
    return (
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {predavaky.map(p => (
          <PredavakRow key={p.id} p={p} zakazkaId={zakazkaId} canApprove={canApprove} loading={loading} onSchvalit={onSchvalit} onOdmitnout={onOdmitnout} />
        ))}
      </div>
    )
  }

  const bezEtapy = predavaky.filter(p => !p.etapaId)

  return (
    <div>
      {etapy.map(etapa => {
        const pp = predavaky.filter(p => p.etapaId === etapa.id)
        const label = etapa.nazev ? `Etapa ${etapa.cislo} — ${etapa.nazev}` : `Etapa ${etapa.cislo}`
        return (
          <div key={etapa.id}>
            <div className="px-5 py-2 flex items-center justify-between bg-gray-50 dark:bg-slate-700/40">
              <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
              {canCreate && (
                <button
                  onClick={() => onNovy(etapa.id)}
                  disabled={loading === 'new'}
                  className="text-xs font-medium text-green-700 dark:text-green-400 hover:underline disabled:opacity-50"
                >
                  {loading === 'new' ? '…' : '+ Nový protokol'}
                </button>
              )}
            </div>
            {pp.length === 0 ? (
              <div className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500 italic">Žádné protokoly</div>
            ) : (
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {pp.map(p => <PredavakRow key={p.id} p={p} zakazkaId={zakazkaId} canApprove={canApprove} loading={loading} onSchvalit={onSchvalit} onOdmitnout={onOdmitnout} />)}
              </div>
            )}
          </div>
        )
      })}
      {bezEtapy.length > 0 && (
        <div>
          <div className="px-5 py-2 bg-gray-50 dark:bg-slate-700/40">
            <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Bez etapy</span>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {bezEtapy.map(p => <PredavakRow key={p.id} p={p} zakazkaId={zakazkaId} canApprove={canApprove} loading={loading} onSchvalit={onSchvalit} onOdmitnout={onOdmitnout} />)}
          </div>
        </div>
      )}
    </div>
  )
}
