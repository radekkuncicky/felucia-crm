'use client'

import { useId, useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'

export interface TechnikRef {
  id: string
  jmeno: string
}

interface Props {
  technici: TechnikRef[]
  /** Technici organizace, ze kterých se vybírá */
  vsichni: TechnikRef[]
  canEdit: boolean
  /** POST { technikId } */
  addUrl: string
  /** DELETE {addUrl}/{technikId} */
  removeUrl?: (technikId: string) => string
  /** Potvrzení odebrání (např. zakázka: odebere i z etap) */
  confirmRemove?: (technik: TechnikRef) => Promise<boolean>
  onChange?: (technici: TechnikRef[]) => void
  emptyText?: string
  className?: string
}

/**
 * Štítky přiřazených techniků + „+ Technik" (výběr ze seznamu) a odebrání křížkem.
 * Používá hlavička zakázky (celá zakázka) i karty etap.
 */
export default function TechniciPicker({
  technici: initial, vsichni, canEdit, addUrl, removeUrl, confirmRemove, onChange,
  emptyText = 'Nikdo nepřiřazen', className,
}: Props) {
  const router = useRouter()
  const selectId = useId()
  const [technici, setTechnici] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  const assigned = new Set(technici.map(t => t.id))
  const available = vsichni.filter(t => !assigned.has(t.id))

  function update(next: TechnikRef[]) {
    setTechnici(next)
    onChange?.(next)
  }

  async function pridat(technikId: string) {
    const technik = vsichni.find(t => t.id === technikId)
    if (!technik) return
    setBusy('add')
    const res = await api.post<{ zakazkaNovyStav?: string | null }>(addUrl, { technikId })
    setBusy(null)
    setAdding(false)
    if (!res.ok) return
    update([...technici, technik])
    if (res.data?.zakazkaNovyStav === 'PRIRAZENA') {
      toast.success('Technik přiřazen — zakázka je teď ve stavu Přiřazena')
    }
    router.refresh()
  }

  async function odebrat(technik: TechnikRef) {
    if (confirmRemove && !(await confirmRemove(technik))) return
    setBusy(technik.id)
    const res = await api.delete(removeUrl ? removeUrl(technik.id) : `${addUrl}/${technik.id}`)
    setBusy(null)
    if (!res.ok) return
    update(technici.filter(t => t.id !== technik.id))
    router.refresh()
  }

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {technici.length === 0 && !adding && (
        <span className="text-sm text-gray-400 dark:text-slate-500 italic">{emptyText}</span>
      )}
      {technici.map(t => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
        >
          {t.jmeno}
          {canEdit && (
            <button
              type="button"
              data-compact
              onClick={() => odebrat(t)}
              disabled={busy === t.id}
              aria-label={`Odebrat technika ${t.jmeno}`}
              title="Odebrat"
              className="hit-area w-4 h-4 inline-flex items-center justify-center rounded-full hover:bg-blue-100 dark:hover:bg-blue-800/60 disabled:opacity-50"
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </span>
      ))}
      {canEdit && available.length > 0 && (adding ? (
        <>
          <label htmlFor={selectId} className="sr-only">Vyberte technika</label>
          <select
            id={selectId}
            autoFocus
            defaultValue=""
            disabled={busy === 'add'}
            onChange={e => { if (e.target.value) pridat(e.target.value) }}
            onBlur={() => { if (busy !== 'add') setAdding(false) }}
            onKeyDown={e => { if (e.key === 'Escape') { e.stopPropagation(); setAdding(false) } }}
            className="text-xs border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-1 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
          >
            <option value="" disabled>Vyberte technika…</option>
            {available.map(t => <option key={t.id} value={t.id}>{t.jmeno}</option>)}
          </select>
        </>
      ) : (
        <button
          type="button"
          data-compact
          onClick={() => setAdding(true)}
          className="hit-area text-xs font-medium text-primary dark:text-primary-light hover:underline px-1"
        >
          + Technik
        </button>
      ))}
    </div>
  )
}
