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
  /** Hlavní technik (hvězdička); bez `hlavniUrl` se hvězdička nezobrazí */
  hlavniId?: string | null
  /** PATCH { hlavniTechnikId } — zakázka nebo etapa */
  hlavniUrl?: string
  emptyText?: string
  className?: string
}

/**
 * Štítky přiřazených techniků + „+ Technik" (výběr ze seznamu) a odebrání křížkem.
 * Používá hlavička zakázky (celá zakázka) i karty etap.
 */
export default function TechniciPicker({
  technici: initial, vsichni, canEdit, addUrl, removeUrl, confirmRemove, onChange,
  hlavniId: initialHlavni = null, hlavniUrl,
  emptyText = 'Nikdo nepřiřazen', className,
}: Props) {
  const router = useRouter()
  const selectId = useId()
  const [technici, setTechnici] = useState(initial)
  const [adding, setAdding] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [hlavni, setHlavni] = useState<string | null>(initialHlavni)
  // Server přiřadí hlavního automaticky prvnímu technikovi — UI to jen zrcadlí
  const hlavniPlatny = hlavni && technici.some(t => t.id === hlavni) ? hlavni : (technici[0]?.id ?? null)
  const serazeni = hlavniUrl && hlavniPlatny
    ? [...technici].sort((a, b) => (a.id === hlavniPlatny ? -1 : b.id === hlavniPlatny ? 1 : 0))
    : technici

  async function nastavitHlavniho(technik: TechnikRef) {
    if (!hlavniUrl || technik.id === hlavniPlatny) return
    setBusy(`hlavni-${technik.id}`)
    const res = await api.patch(hlavniUrl, { hlavniTechnikId: technik.id })
    setBusy(null)
    if (!res.ok) return
    setHlavni(technik.id)
    toast.success(`Hlavní technik: ${technik.jmeno}`)
    router.refresh()
  }

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
      {serazeni.map(t => (
        <span
          key={t.id}
          className={cn(
            'inline-flex items-center gap-1 pr-1 py-0.5 rounded-full text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
            hlavniUrl ? 'pl-1' : 'pl-2.5',
          )}
        >
          {hlavniUrl && (
            <button
              type="button"
              data-compact
              onClick={() => nastavitHlavniho(t)}
              disabled={!canEdit || busy === `hlavni-${t.id}`}
              aria-label={t.id === hlavniPlatny ? `${t.jmeno} je hlavní technik` : `Nastavit ${t.jmeno} jako hlavního technika`}
              aria-pressed={t.id === hlavniPlatny}
              title={t.id === hlavniPlatny ? 'Hlavní technik' : canEdit ? 'Nastavit jako hlavního' : undefined}
              className={cn(
                'hit-area w-4 h-4 inline-flex items-center justify-center rounded-full disabled:cursor-default',
                t.id === hlavniPlatny ? 'text-amber-500' : 'text-blue-300 dark:text-blue-700 hover:text-amber-400',
                !canEdit && t.id !== hlavniPlatny && 'invisible',
              )}
            >
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill={t.id === hlavniPlatny ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} aria-hidden>
                <path strokeLinejoin="round" d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
              </svg>
            </button>
          )}
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
