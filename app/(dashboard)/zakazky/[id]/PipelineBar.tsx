'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ZakazkaStav } from '@prisma/client'
import { api } from '@/lib/api'
import { etapaProgressFromRaw, KROK_LABEL, KROK_LABEL_HOTOVO, type EtapaKrok, type EtapaProgressInput } from '@/lib/zakazkaEtapy'

const STEPS: { stav: ZakazkaStav; label: string }[] = [
  { stav: 'NOVA', label: 'Nová' },
  { stav: 'PRIRAZENA', label: 'Přiřazena' },
  { stav: 'V_REALIZACI', label: 'V realizaci' },
  { stav: 'PREDANA', label: 'Předána' },
  { stav: 'VYUCTOVANA', label: 'Vyúčtována' },
  { stav: 'HOTOVO', label: 'Hotovo' },
]

type EtapaChip = EtapaProgressInput & { id: string }

interface Props {
  zakazkaId: string
  currentStav: ZakazkaStav
  canChange: boolean
  etapy?: EtapaChip[]
}

interface EtapaNode {
  key: string
  label: string
  done: boolean
  current: boolean
}

/**
 * Etapy jdou striktně lineárně, každá má 4 kroky (Etapa N → Montáž N →
 * Předávka N → Vyúčtování N). Lišta se s každou přidanou etapou prodlouží
 * o dalších 5 uzlů — dokončené kroky zůstávají viditelné jako historie
 * (viz [[project-batch-tasks-2026-08-22]] úkol 6).
 */
function buildEtapyNodes(etapy: EtapaChip[]): EtapaNode[] {
  const nodes: EtapaNode[] = []
  let currentAssigned = false
  for (const raw of etapy) {
    const p = etapaProgressFromRaw(raw)
    nodes.push({ key: `${raw.id}-etapa`, label: `Etapa ${p.cislo}`, done: true, current: false })
    const kroky: { krok: EtapaKrok; done: boolean }[] = [
      { krok: 'MONTAZ', done: p.montazDone },
      { krok: 'PREDAVKA', done: p.predavkaDone },
      { krok: 'VYUCTOVANI', done: p.vyuctovaniDone },
    ]
    for (const k of kroky) {
      const isCurrent = !currentAssigned && !k.done
      if (isCurrent) currentAssigned = true
      nodes.push({
        key: `${raw.id}-${k.krok}`,
        label: k.done ? `${KROK_LABEL_HOTOVO[k.krok]} ${p.cislo}E` : `${KROK_LABEL[k.krok]} ${p.cislo}`,
        done: k.done,
        current: isCurrent,
      })
    }
  }
  return nodes
}

export default function PipelineBar({ zakazkaId, currentStav, canChange, etapy = [] }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [confirm, setConfirm] = useState<ZakazkaStav | null>(null)
  const currentIndex = STEPS.findIndex(s => s.stav === currentStav)
  const hasEtapy = etapy.length > 0
  const etapyNodes = hasEtapy ? buildEtapyNodes(etapy) : []

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
        {hasEtapy ? (
          <>
            {/* Desktop: prodlužující se lišta etap */}
            <div className="hidden sm:flex items-center flex-wrap gap-y-2">
              <span
                className="mr-2 flex-shrink-0 text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 cursor-help transition-colors"
                title="Etapy jdou striktně za sebou — další etapu lze přidat, až je ta předchozí kompletně vyúčtovaná."
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </span>
              {etapyNodes.map((n, i) => (
                <div key={n.key} className="flex items-center">
                  <span className={`flex items-center gap-1.5 text-xs font-medium whitespace-nowrap ${
                    n.current ? 'text-green-600 dark:text-green-400' : n.done ? 'text-gray-400 dark:text-slate-500' : 'text-gray-300 dark:text-slate-600'
                  }`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-[10px] border-2 ${
                      n.current
                        ? 'border-green-500 bg-green-500 text-white'
                        : n.done
                        ? 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'
                        : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-300 dark:text-slate-600'
                    }`}>
                      {n.done ? '✓' : ''}
                    </span>
                    {n.label}
                  </span>
                  {i < etapyNodes.length - 1 && (
                    <div className={`w-4 h-0.5 mx-1 ${n.done ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'}`} />
                  )}
                </div>
              ))}
            </div>

            {/* Mobile: horizontálně scrollovatelné */}
            <div className="sm:hidden overflow-x-auto scrollbar-none -mx-1 px-1">
              <div className="flex items-center gap-1 pb-1" style={{ minWidth: 'max-content' }}>
                {etapyNodes.map((n, i) => (
                  <div key={n.key} className="flex items-center">
                    <div
                      style={{ minWidth: 64, fontSize: 10 }}
                      className={`flex flex-col items-center gap-1 px-1.5 py-1.5 rounded-lg ${
                        n.current ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : n.done ? 'text-gray-400 dark:text-slate-500' : 'text-gray-300 dark:text-slate-600'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 flex-shrink-0 ${
                        n.current
                          ? 'border-green-500 bg-green-500 text-white'
                          : n.done
                          ? 'border-gray-300 dark:border-slate-600 bg-gray-100 dark:bg-slate-700 text-gray-500'
                          : 'border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-300'
                      }`}>
                        {n.done ? '✓' : ''}
                      </span>
                      <span className="whitespace-nowrap">{n.label}</span>
                    </div>
                    {i < etapyNodes.length - 1 && (
                      <div className={`w-2 h-0.5 flex-shrink-0 ${n.done ? 'bg-gray-300 dark:bg-slate-600' : 'bg-gray-100 dark:bg-slate-700'}`} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
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
          </>
        )}
      </div>
    </>
  )
}
