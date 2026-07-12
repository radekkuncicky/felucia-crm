'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { getPlanLimits } from '@/lib/planLimits'

type StavDealu = 'NOVY' | 'JEDNANI' | 'NABIDKA' | 'PRED_UZAVRENIM' | 'USPECH' | 'PAS' | 'ZNEPLATNENO'

const stavOptions: { value: StavDealu; label: string; color: string; dot: string }[] = [
  { value: 'NOVY',           label: 'Nový',             color: 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300',      dot: 'bg-gray-400' },
  { value: 'JEDNANI',        label: 'Jednání',          color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',    dot: 'bg-blue-500' },
  { value: 'NABIDKA',        label: 'Nabídka',          color: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300', dot: 'bg-yellow-500' },
  { value: 'PRED_UZAVRENIM', label: 'Před uzavřením',   color: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300', dot: 'bg-orange-500' },
  { value: 'USPECH',         label: 'Úspěch',           color: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300', dot: 'bg-green-500' },
  { value: 'PAS',            label: 'Prohráno',           color: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',       dot: 'bg-red-500' },
  { value: 'ZNEPLATNENO',    label: 'Zneplatněno',      color: 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400',    dot: 'bg-gray-400' },
]

interface Props {
  dealId: string
  currentStav: StavDealu
  plan?: string
  klientId?: string
  klientJmeno?: string
  povinnaAktivitaUOP?: boolean
  automatickyServis?: boolean
}

export default function DealStatusBadge({ dealId, currentStav, plan, klientId, klientJmeno, automatickyServis = true }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const isAdmin = session?.user?.role === 'ADMIN' || session?.user?.isSuperAdmin === true
  const [open, setOpen] = useState(false)
  const [stav, setStav] = useState<StavDealu>(currentStav)
  const [saving, setSaving] = useState(false)
  const [pasModal, setPasModal] = useState(false)
  const [duvodProhry, setDuvodProhry] = useState('')
  const [pendingStav, setPendingStav] = useState<StavDealu | null>(null)
  const [servisModal, setServisModal] = useState(false)
  const [servisForm, setServisForm] = useState({
    nazev: '',
    typ: 'ROCNI',
    intervalMesicu: 12,
    cena: '',
    zacatek: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    poznamka: '',
  })
  const [servisSaving, setServisSaving] = useState(false)
  const [servisError, setServisError] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const [aktivitaError, setAktivitaError] = useState(false)

  async function changeStav(newStav: StavDealu, duvod?: string) {
    setSaving(true)
    setOpen(false)
    setAktivitaError(false)
    try {
      const body: Record<string, unknown> = { stav: newStav }
      if (duvod) body.duvodProhry = duvod
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.chybaPovinnaAktivita) {
          setAktivitaError(true)
          setSaving(false)
          return
        }
        setStav(newStav)
        if (data.suggestServiceContract && getPlanLimits(plan ?? 'STARTER').hasServiceModule && automatickyServis) {
          setServisForm(f => ({ ...f, nazev: `Roční servis – ${klientJmeno ?? ''}`.trim() }))
          setServisModal(true)
        } else {
          router.refresh()
        }
      }
    } finally {
      setSaving(false)
    }
  }

  async function createServisniKontrakt() {
    setServisSaving(true)
    setServisError('')
    try {
      const intervalMap: Record<string, number> = { ROCNI: 12, POLOLETNI: 6, DVOULETNI: 24, JEDNOURAZOVY: 0 }
      const res = await fetch('/api/servis/kontrakty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dealId,
          klientId,
          nazev: servisForm.nazev,
          typ: servisForm.typ,
          intervalMesicu: servisForm.typ === 'JEDNOURAZOVY' ? 0 : intervalMap[servisForm.typ],
          cena: servisForm.cena || null,
          zacatek: servisForm.zacatek,
          poznamka: servisForm.poznamka || null,
        }),
      })
      if (res.ok) {
        setServisModal(false)
        router.refresh()
      } else {
        const data = await res.json().catch(() => ({}))
        setServisError(data.error || 'Nepodařilo se vytvořit servisní kontrakt')
      }
    } catch {
      setServisError('Nepodařilo se vytvořit servisní kontrakt')
    } finally {
      setServisSaving(false)
    }
  }

  function selectStav(newStav: StavDealu) {
    if (newStav === 'PAS') {
      setPendingStav(newStav)
      setPasModal(true)
      setOpen(false)
    } else {
      changeStav(newStav)
    }
  }

  async function confirmPas() {
    if (!duvodProhry.trim() || !pendingStav) return
    setPasModal(false)
    await changeStav(pendingStav, duvodProhry.trim())
    setDuvodProhry('')
    setPendingStav(null)
  }

  const current = stavOptions.find(s => s.value === stav)!

  return (
    <>
      {/* PAS Modal */}
      {pasModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">Důvod prohry</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 mb-4">Zadejte důvod, proč byl obchodní případ označen jako Pass.</p>
            <textarea
              autoFocus
              rows={4}
              value={duvodProhry}
              onChange={e => setDuvodProhry(e.target.value)}
              placeholder="Např. cena, konkurence, zákazník zrušil záměr…"
              className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 resize-none"
            />
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Povinné pole</p>
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => { setPasModal(false); setDuvodProhry(''); setPendingStav(null) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Zrušit
              </button>
              <button
                onClick={confirmPas}
                disabled={!duvodProhry.trim() || saving}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
              >
                Uložit a označit jako Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aktivita error toast */}
      {aktivitaError && (
        <div className="fixed bottom-6 right-6 z-50 bg-red-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm font-medium max-w-sm" onClick={() => setAktivitaError(false)}>
          Před uzavřením OP je nutná alespoň jedna aktivita typu Hovor nebo Schůzka.
        </div>
      )}

      {/* Service contract suggestion modal */}
      {servisModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-2xl max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-primary dark:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Vytvořit servisní kontrakt?</h3>
                <p className="text-sm text-gray-500 dark:text-slate-400">Zakázka byla předána – chcete nastavit servis?</p>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Název kontraktu</label>
                <input
                  type="text"
                  value={servisForm.nazev}
                  onChange={e => setServisForm(f => ({ ...f, nazev: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Typ servisu</label>
                  <select
                    value={servisForm.typ}
                    onChange={e => {
                      const typ = e.target.value
                      const intervals: Record<string, number> = { ROCNI: 12, POLOLETNI: 6, DVOULETNI: 24, JEDNOURAZOVY: 0 }
                      setServisForm(f => ({ ...f, typ, intervalMesicu: intervals[typ] }))
                    }}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  >
                    <option value="ROCNI">Roční</option>
                    <option value="POLOLETNI">Pololetní</option>
                    <option value="DVOULETNI">Dvouletní</option>
                    <option value="JEDNOURAZOVY">Jednorázový</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Začátek servisu</label>
                  <input
                    type="date"
                    value={servisForm.zacatek}
                    onChange={e => setServisForm(f => ({ ...f, zacatek: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Cena (Kč, volitelné)</label>
                <input
                  type="number"
                  value={servisForm.cena}
                  onChange={e => setServisForm(f => ({ ...f, cena: e.target.value }))}
                  placeholder="Např. 3500"
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            {servisError && (
              <p className="mt-3 text-sm text-red-600 dark:text-red-400">{servisError}</p>
            )}
            <div className="flex gap-3 justify-end mt-5">
              <button
                onClick={() => { setServisModal(false); router.refresh() }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Přeskočit
              </button>
              <button
                onClick={createServisniKontrakt}
                disabled={!servisForm.nazev.trim() || servisSaving}
                className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
              >
                {servisSaving ? 'Vytváří se…' : 'Vytvořit kontrakt'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Badge + dropdown */}
      <div ref={ref} className="relative inline-block">
        <button
          onClick={() => setOpen(o => !o)}
          disabled={saving}
          className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer hover:opacity-80 transition-opacity disabled:opacity-60 ${current.color}`}
          title="Klikněte pro změnu stavu"
        >
          <span>{current.label}</span>
          <svg className="w-3 h-3 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {open && (
          <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl shadow-xl z-30 min-w-[180px] overflow-hidden">
            {stavOptions.filter(opt => opt.value !== 'ZNEPLATNENO' || isAdmin).map(opt => (
              <button
                key={opt.value}
                onClick={() => selectStav(opt.value)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-left hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors ${opt.value === stav ? 'bg-gray-50 dark:bg-slate-700 font-semibold' : ''}`}
              >
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${opt.dot}`} />
                <span className="text-gray-700 dark:text-slate-300">{opt.label}</span>
                {opt.value === stav && <span className="ml-auto text-blue-500">✓</span>}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
