'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZakazkaStav, EtapaStav } from '@prisma/client'
import { api } from '@/lib/api'

const STEPS: { stav: ZakazkaStav; label: string }[] = [
  { stav: 'NOVA', label: 'Nová' },
  { stav: 'PRIRAZENA', label: 'Přiřazena' },
  { stav: 'V_REALIZACI', label: 'V realizaci' },
  { stav: 'PREDANA', label: 'Předána' },
  { stav: 'VYUCTOVANA', label: 'Vyúčtována' },
  { stav: 'HOTOVO', label: 'Hotovo' },
]

interface EtapaChip {
  id: string
  cislo: number
  nazev: string | null
  stav: EtapaStav
}

interface Props {
  zakazkaId: string
  currentStav: ZakazkaStav
  canChange: boolean
  etapy?: EtapaChip[]
}

export default function PipelineBar({ zakazkaId, currentStav, canChange, etapy = [] }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<ZakazkaStav | null>(null)
  const currentIndex = STEPS.findIndex(s => s.stav === currentStav)
  const hasEtapy = etapy.length > 0

  async function handleChange(stav: ZakazkaStav) {
    setConfirm(null)
    setLoading(true)
    try {
      const res = await api.patch(`/api/zakazky/${zakazkaId}/stav`, { stav },
        { errorMessage: 'Změnu stavu se nepodařilo uložit.' })
      if (res.ok) {
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Změnit stav zakázky</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">
              Přejít na stav <strong>{STEPS.find(s => s.stav === confirm)?.label}</strong>?
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirm(null)} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={() => handleChange(confirm)} disabled={loading} className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
                {loading ? 'Ukládám…' : 'Potvrdit'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-3">
        {/* Desktop steps */}
        <div className="hidden sm:flex items-center">
          <span
            className="mr-2 flex-shrink-0 text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 cursor-help transition-colors"
            title="Stavy se posouvají automaticky: přiřazení technika → Přiřazena, naskladnění → V realizaci, podpis protokolu → Předána, schválení vyúčtování → Vyúčtována. Ručně lze stav posunout kliknutím."
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          {STEPS.map((step, i) => {
            if (step.stav === 'PREDANA' && hasEtapy) {
              const allDone = etapy.every(e => e.stav === 'PREDANA')
              const beforeVyu = currentIndex >= STEPS.findIndex(s => s.stav === 'VYUCTOVANA')
              return (
                <div key="etapy" className="flex items-center flex-1 min-w-0">
                  <div className="flex items-center gap-1 flex-wrap">
                    {etapy.map(e => (
                      <span
                        key={e.id}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                          e.stav === 'PREDANA'
                            ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-300 dark:border-green-800'
                            : e.stav === 'PROBIHAJICI'
                            ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-300 dark:border-blue-800'
                            : 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600'
                        }`}
                      >
                        {e.stav === 'PREDANA' ? '✓' : e.cislo}
                        <span className="hidden lg:inline">
                          {e.nazev ? ` ${e.nazev}` : ` E${e.cislo}`}
                        </span>
                      </span>
                    ))}
                  </div>
                  <div className={`flex-1 h-0.5 mx-1 ${(allDone || beforeVyu) ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'}`} />
                </div>
              )
            }

            const isDone = i < currentIndex
            const isCurrent = i === currentIndex
            const isClickable = canChange && !loading

            return (
              <div key={step.stav} className="flex items-center flex-1 min-w-0">
                <button
                  onClick={() => isClickable && canChange && step.stav !== currentStav ? setConfirm(step.stav) : undefined}
                  disabled={!isClickable || step.stav === currentStav}
                  className={`flex items-center gap-1.5 text-xs font-medium transition-colors disabled:cursor-default ${
                    isCurrent
                      ? 'text-green-600 dark:text-green-400'
                      : isDone
                      ? 'text-gray-400 dark:text-slate-500 hover:text-primary dark:hover:text-primary-light cursor-pointer'
                      : 'text-gray-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 cursor-pointer'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs border-2 ${
                    isCurrent
                      ? 'border-green-500 bg-green-500 text-white'
                      : isDone
                      ? 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                      : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-300 dark:text-slate-600'
                  }`}>
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span className="truncate hidden lg:inline">{step.label}</span>
                </button>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-1 ${i < currentIndex ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'}`} />
                )}
              </div>
            )
          })}
        </div>

        {/* Mobile: horizontally scrollable steps */}
        <div className="sm:hidden overflow-x-auto scrollbar-none -mx-1 px-1">
          <div className="flex items-center gap-1 pb-1" style={{ minWidth: 'max-content' }}>
            {STEPS.map((step, i) => {
              const isDone = i < currentIndex
              const isCurrent = i === currentIndex
              const isClickable = canChange && !loading
              return (
                <div key={step.stav} className="flex items-center">
                  <button
                    onClick={() => isClickable && step.stav !== currentStav ? setConfirm(step.stav) : undefined}
                    disabled={!isClickable || step.stav === currentStav}
                    style={{ minWidth: 72, fontSize: 11 }}
                    className={`flex flex-col items-center gap-1 px-2 py-1.5 rounded-lg transition-colors disabled:cursor-default ${
                      isCurrent
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : isDone
                        ? 'text-gray-400 dark:text-slate-500'
                        : 'text-gray-300 dark:text-slate-600'
                    }`}
                  >
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 flex-shrink-0 ${
                      isCurrent
                        ? 'border-green-500 bg-green-500 text-white'
                        : isDone
                        ? 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-500'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-300'
                    }`}>
                      {isDone ? '✓' : i + 1}
                    </span>
                    <span className="whitespace-nowrap">{step.label}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={`w-3 h-0.5 flex-shrink-0 ${i < currentIndex ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </>
  )
}
