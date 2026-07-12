'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import ProductCatalogModal from '@/components/ProductCatalogModal'
import ConfirmModal from '@/components/ConfirmModal'

const SHEET_ICON_PATHS: Record<string, string> = {
  save: 'M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  check: 'M5 13l4 4L19 7',
}

function SheetIcon({ name }: { name: string }) {
  return (
    <svg className="w-5 h-5 text-green-200/80 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
      <path d={SHEET_ICON_PATHS[name] ?? SHEET_ICON_PATHS.check} />
    </svg>
  )
}


interface QuoteItemData {
  id: string
  kod: string | null
  nazev: string
  mnozstvi: number
  jednotka: string
  cenaZaKus: number
  nakupniCena?: number | null
  sleva: number
  dphSazba: number
  poznamky: string | null
  productId: string | null
  poradi: number
}

interface QuoteData {
  id: string
  kod: string | null
  nazev: string
  popis: string
  dphSazba: number
  aktivni: boolean
  templateId: string | null
  items: QuoteItemData[]
  vytvoreno: string
}

interface RenderTemplate {
  id: string
  nazev: string
  typ: string
  isDefault: boolean
  isSystem: boolean
}

interface ProductData {
  id: string
  nazev: string
  cena: number
  nakladovaCena?: number | null
  kategorie: string | null
  categoryId: string | null
  jednotka: string
  categoryNazev?: string
}

interface TemplateItem {
  product_id?: string
  nazev: string
  mnozstvi: number
  cena_za_kus: number
  jednotka?: string
  poznamky?: string
}

interface TemplateData {
  id: string
  nazev: string
  polozky: TemplateItem[]
}

interface Props {
  dealId: string
  dealKod?: string | null
  quotes: QuoteData[]
  products: ProductData[]
  templates: TemplateData[]
  renderTemplates: RenderTemplate[]
  dphSazba: number
  userRole: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeItem(item: any): QuoteItemData {
  return {
    id: item.id,
    kod: item.kod ?? null,
    nazev: item.nazev ?? '',
    mnozstvi: Number(item.mnozstvi ?? 1),
    jednotka: item.jednotka ?? 'ks',
    cenaZaKus: Number(item.cenaZaKus ?? 0),
    nakupniCena: item.nakupniCena != null ? Number(item.nakupniCena) : null,
    sleva: Number(item.sleva ?? 0),
    dphSazba: Number(item.dphSazba ?? 12),
    poznamky: item.poznamky ?? null,
    productId: item.productId ?? null,
    poradi: Number(item.poradi ?? 0),
  }
}


// ── Sortable row ──────────────────────────────────────────────────────────────

function SortableRow({
  item,
  idx,
  onUpdate,
  onDelete,
  isManazer,
}: {
  item: QuoteItemData
  idx: number
  onUpdate: (id: string, updates: Partial<QuoteItemData>) => void
  onDelete: (id: string) => void
  isManazer: boolean
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const [originals, setOriginals] = useState<Record<string, string>>({})

  const celkem = item.mnozstvi * item.cenaZaKus * (1 - (item.sleva || 0) / 100)

  const inputCls =
    'h-7 w-full px-2 text-[13px] border border-transparent rounded ' +
    'hover:border-gray-200 dark:hover:border-slate-600 ' +
    'focus:border-blue-400 focus:outline-none focus:bg-white dark:focus:bg-slate-700 ' +
    'bg-transparent text-gray-900 dark:text-white'

  function mkInput(
    field: string,
    value: string | number,
    type: 'text' | 'number',
    cls = '',
    attrs: React.InputHTMLAttributes<HTMLInputElement> = {}
  ) {
    return (
      <input
        type={type}
        data-row={idx}
        data-field={field}
        value={value === null || value === undefined ? '' : value}
        className={`${inputCls} ${cls}`}
        onFocus={e => {
          setOriginals(p => ({ ...p, [field]: e.target.value }))
          e.target.select()
        }}
        onChange={e => {
          const v =
            type === 'number'
              ? e.target.value === ''
                ? 0
                : parseFloat(e.target.value) || 0
              : e.target.value
          onUpdate(item.id, { [field]: v } as Partial<QuoteItemData>)
        }}
        onKeyDown={e => {
          if (e.key === 'Escape') {
            e.preventDefault()
            const orig = originals[field]
            if (orig !== undefined) {
              const v =
                type === 'number'
                  ? orig === ''
                    ? 0
                    : parseFloat(orig) || 0
                  : orig
              onUpdate(item.id, { [field]: v } as Partial<QuoteItemData>)
            }
            ;(e.target as HTMLInputElement).blur()
          } else if (e.key === 'Enter') {
            e.preventDefault()
            const next = document.querySelector(
              `[data-row="${idx + 1}"][data-field="${field}"]`
            ) as HTMLInputElement | null
            if (next) {
              next.focus()
              next.select()
            }
          }
        }}
        {...attrs}
      />
    )
  }

  return (
    <tr
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        isDragging
          ? 'opacity-40 outline outline-1 outline-dashed outline-green-500 bg-green-50 dark:bg-green-900/20'
          : 'hover:bg-gray-50/70 dark:hover:bg-slate-700/20 group'
      }
    >
      {/* Drag handle */}
      <td className="pl-1.5 pr-0 w-6">
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-gray-300 dark:text-slate-600 hover:text-gray-500 dark:hover:text-slate-400 touch-none select-none px-1 text-sm leading-7"
          tabIndex={-1}
        >
          ⠿
        </button>
      </td>
      {/* Kód */}
      <td className="px-0.5" style={{ width: 84 }}>
        {mkInput('kod', item.kod ?? '', 'text', 'font-mono text-[12px]')}
      </td>
      {/* Název */}
      <td className="px-0.5">{mkInput('nazev', item.nazev, 'text')}</td>
      {/* Množství */}
      <td className="px-0.5" style={{ width: 68 }}>
        {mkInput('mnozstvi', item.mnozstvi, 'number', 'text-right', {
          min: '0',
          step: '0.001',
        })}
      </td>
      {/* Jednotka */}
      <td className="px-0.5" style={{ width: 64 }}>
        {mkInput('jednotka', item.jednotka, 'text')}
      </td>
      {/* Cena/ks */}
      <td className="px-0.5" style={{ width: 96 }}>
        {mkInput('cenaZaKus', item.cenaZaKus, 'number', 'text-right', {
          min: '0',
          step: '0.01',
        })}
      </td>
      {/* NK. cena — only for MANAZER/ADMIN */}
      {isManazer && (
        <td className="px-0.5" style={{ width: 88 }}>
          <input
            type="number"
            value={item.nakupniCena ?? ''}
            placeholder="—"
            min="0"
            step="0.01"
            className={`${inputCls} text-right text-[13px]`}
            onChange={e => onUpdate(item.id, {
              nakupniCena: e.target.value === '' ? null : (parseFloat(e.target.value) || 0),
            })}
          />
        </td>
      )}
      {/* Sleva % */}
      <td className="px-0.5" style={{ width: 64 }}>
        {mkInput('sleva', item.sleva, 'number', 'text-right', {
          min: '0',
          max: '100',
          step: '1',
        })}
      </td>
      {/* DPH % */}
      <td className="px-0.5" style={{ width: 60 }}>
        <select
          value={item.dphSazba}
          onChange={e => onUpdate(item.id, { dphSazba: Number(e.target.value) })}
          className="h-7 w-full px-1 text-[13px] border border-transparent rounded hover:border-gray-200 dark:hover:border-slate-600 focus:border-blue-400 focus:outline-none focus:bg-white dark:focus:bg-slate-700 bg-transparent text-gray-900 dark:text-white text-right"
        >
          <option value={0}>0 %</option>
          <option value={12}>12 %</option>
          <option value={21}>21 %</option>
        </select>
      </td>
      {/* Celkem (readonly) */}
      <td
        className="pr-2 text-right text-[13px] font-semibold text-gray-900 dark:text-white tabular-nums"
        style={{ width: 96 }}
      >
        {celkem.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })}
      </td>
      {/* Delete */}
      <td className="pr-1.5 text-center" style={{ width: 28 }}>
        <button
          onClick={() => onDelete(item.id)}
          tabIndex={-1}
          title="Smazat"
          className="text-gray-200 dark:text-slate-700 hover:text-red-500 dark:hover:text-red-400 text-lg leading-none opacity-0 group-hover:opacity-100 transition-opacity"
        >
          ×
        </button>
      </td>
    </tr>
  )
}

// ── DuplicateToModal ──────────────────────────────────────────────────────────

type DealOption = { id: string; predmet: string | null; kod: string | null; client: { jmeno: string; prijmeni: string } }

function DuplicateToModal({
  dealId,
  quoteId,
  quoteName,
  onClose,
  onSuccess,
}: {
  dealId: string
  quoteId: string
  quoteName: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [search, setSearch] = useState('')
  const [deals, setDeals] = useState<DealOption[]>([])
  const [loadingDeals, setLoadingDeals] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')

  const selectedDeal = deals.find(d => d.id === selected) ?? null

  useEffect(() => {
    setLoadingDeals(true)
    setLoadError(false)
    fetch(`/api/deals?search=${encodeURIComponent(search)}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: DealOption[]) => setDeals(data.filter(d => d.id !== dealId)))
      .catch(() => setLoadError(true))
      .finally(() => setLoadingDeals(false))
  }, [search, dealId])

  async function handleConfirm() {
    if (!selected) return
    setSubmitting(true)
    setSubmitError('')
    try {
      const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}/duplicate-to`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetDealId: selected }),
      })
      if (res.ok) { onSuccess(); onClose() }
      else setSubmitError('Duplikaci se nepodařilo provést')
    } catch {
      setSubmitError('Duplikaci se nepodařilo provést')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh]">

        {/* Header */}
        <div className="px-6 pt-5 pb-4 border-b border-gray-100 dark:border-slate-700">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
                <svg className="w-4.5 h-4.5 text-primary dark:text-primary-light" fill="none" stroke="currentColor" viewBox="0 0 24 24" width="18" height="18">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900 dark:text-white leading-tight">
                  Zkopírovat nabídku
                </h3>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">do jiného obchodního případu</p>
              </div>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 p-0.5 rounded mt-0.5">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Source → Destination flow */}
          <div className="flex items-center gap-2 text-sm">
            {/* Source */}
            <div className="flex-1 min-w-0 bg-gray-50 dark:bg-slate-700/60 border border-gray-200 dark:border-slate-600 rounded-xl px-3 py-2.5">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-0.5">Nabídka</p>
              <p className="text-sm font-medium text-gray-800 dark:text-slate-200 truncate">{quoteName}</p>
            </div>
            {/* Arrow */}
            <div className="flex-shrink-0 text-gray-300 dark:text-slate-600">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </div>
            {/* Destination */}
            <div className={`flex-1 min-w-0 border rounded-xl px-3 py-2.5 transition-colors ${selectedDeal ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-300 dark:border-blue-700' : 'bg-gray-50 dark:bg-slate-700/60 border-dashed border-gray-300 dark:border-slate-600'}`}>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 dark:text-slate-500 mb-0.5">Cíl</p>
              {selectedDeal ? (
                <>
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300 truncate">{selectedDeal.predmet ?? 'Bez předmětu'}</p>
                  <p className="text-xs text-blue-500 dark:text-blue-400 truncate">{selectedDeal.client.jmeno} {selectedDeal.client.prijmeni}</p>
                </>
              ) : (
                <p className="text-sm text-gray-400 dark:text-slate-500 italic">vyber níže…</p>
              )}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              autoFocus
              placeholder="Klient, název zakázky nebo kód…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
            />
          </div>
        </div>

        {/* Deal list */}
        <div className="flex-1 overflow-y-auto">
          {loadingDeals && (
            <div className="flex items-center justify-center py-10">
              <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!loadingDeals && loadError && (
            <p className="px-4 py-8 text-sm text-center text-red-500">Nepodařilo se načíst obchodní případy</p>
          )}
          {!loadingDeals && !loadError && deals.length === 0 && (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-gray-400 dark:text-slate-500">{search ? `Žádný výsledek pro „${search}"` : 'Žádné obchodní případy'}</p>
            </div>
          )}
          {!loadingDeals && deals.map(d => {
            const isSelected = selected === d.id
            return (
              <label
                key={d.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors border-b border-gray-50 dark:border-slate-700/50 last:border-0 ${isSelected ? 'bg-blue-50 dark:bg-blue-950/20' : 'hover:bg-gray-50 dark:hover:bg-slate-700/40'}`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${isSelected ? 'border-primary bg-primary' : 'border-gray-300 dark:border-slate-500'}`}>
                  {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                </div>
                <input type="radio" name="targetDeal" checked={isSelected} onChange={() => setSelected(d.id)} className="sr-only" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {d.kod && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{d.kod}</span>}
                    <span className={`text-sm font-medium truncate ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}>
                      {d.predmet ?? 'Bez předmětu'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5 truncate">
                    {d.client.jmeno} {d.client.prijmeni}
                  </p>
                </div>
                {isSelected && (
                  <svg className="w-4 h-4 text-primary dark:text-primary-light flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </label>
            )
          })}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700">
          {submitError && <p className="text-sm text-red-500 mb-3">{submitError}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="flex-1 px-4 py-2.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-700 font-medium">
              Zrušit
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selected || submitting}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-primary hover:bg-primary-hover rounded-xl disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Kopíruji…</>
              ) : (
                <><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg> Zkopírovat nabídku</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function NabidkyTab({
  dealId,
  quotes: initQuotes,
  products,
  templates,
  renderTemplates,
  dphSazba: dealDph,
  userRole,
}: Props) {
  const [quotes, setQuotes] = useState(() =>
    initQuotes.map(q => ({
      ...q,
      items: [...q.items]
        .map(normalizeItem)
        .sort((a, b) => a.poradi - b.poradi),
    }))
  )
  const [selectedQuoteId, setSelectedQuoteId] = useState(
    initQuotes.find(q => q.aktivni)?.id ?? initQuotes[0]?.id ?? null
  )
  const [saving, setSaving] = useState(false)
  const [showProductModal, setShowProductModal] = useState(false)
  const [showDuplicateToModal, setShowDuplicateToModal] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal] = useState('')
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [editingNameValue, setEditingNameValue] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [toastType, setToastType] = useState<'success' | 'error'>('success')
  const [pdfLoading, setPdfLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [deleteQuoteId, setDeleteQuoteId] = useState<string | null>(null)
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<
    'idle' | 'dirty' | 'saving' | 'saved'
  >('idle')
  const [moreOpen, setMoreOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const isManazer = userRole === 'MANAZER' || userRole === 'ADMIN'
  const router = useRouter()

  // Auto-activate first CN if none is active on mount
  useEffect(() => {
    if (initQuotes.length > 0 && !initQuotes.some(q => q.aktivni)) {
      setActive(initQuotes[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const quotesRef = useRef(quotes)
  useEffect(() => {
    quotesRef.current = quotes
  }, [quotes])
  const selectedQuoteIdRef = useRef(selectedQuoteId)
  useEffect(() => {
    selectedQuoteIdRef.current = selectedQuoteId
  }, [selectedQuoteId])
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = useRef(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const selectedQuote =
    quotes.find(q => q.id === selectedQuoteId) ?? null
  const dphRate = selectedQuote?.dphSazba ?? dealDph
  const total =
    selectedQuote?.items.reduce(
      (s, i) =>
        s + i.mnozstvi * i.cenaZaKus * (1 - (i.sleva || 0) / 100),
      0
    ) ?? 0
  const totalDph = total * (1 + dphRate / 100)

  // Margin calculation — item.nakupniCena ?? product.nakladovaCena ?? cenaZaKus (0% margin fallback)
  // NOTE: sleva is a customer discount on the sell price — it does NOT affect purchase cost
  const nakupniTotal = selectedQuote?.items.reduce((s, i) => {
    const prod = i.productId ? products.find(p => p.id === i.productId) : null
    const nakladovaCena = i.nakupniCena ?? prod?.nakladovaCena ?? i.cenaZaKus
    return s + Number(nakladovaCena) * i.mnozstvi
  }, 0) ?? 0
  const hasNakupniCena = selectedQuote?.items.some(i => {
    if (i.nakupniCena != null) return true
    if (!i.productId) return false
    const prod = products.find(p => p.id === i.productId)
    return !!(prod?.nakladovaCena)
  }) ?? false
  const marzeQuote = (isManazer || hasNakupniCena) && total > 0
    ? { kc: total - nakupniTotal, proc: (total - nakupniTotal) / total * 100 }
    : null

  // beforeunload warning
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirtyRef.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  function showToast(msg: string) {
    setToast(msg)
    setToastType('success')
    setTimeout(() => setToast(null), 3000)
  }

  function showError(msg: string) {
    setToast(msg)
    setToastType('error')
    setTimeout(() => setToast(null), 4000)
  }

  // ── Auto-save ─────────────────────────────────────────────────────────────

  const doSave = useCallback(async (targetQuoteId?: string) => {
    const qId = targetQuoteId ?? selectedQuoteIdRef.current
    if (!qId) return
    setSaveStatus('saving')
    const items = quotesRef.current.find(q => q.id === qId)?.items ?? []
    try {
      await Promise.all(
        items.map(item =>
          fetch(
            `/api/deals/${dealId}/quotes/${qId}/items/${item.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                kod: item.kod ?? null,
                nazev: item.nazev,
                mnozstvi: Number(item.mnozstvi),
                jednotka: item.jednotka,
                cenaZaKus: Number(item.cenaZaKus),
                nakupniCena: item.nakupniCena !== undefined ? item.nakupniCena : null,
                sleva: Number(item.sleva || 0),
                dphSazba: Number(item.dphSazba),
                poznamky: item.poznamky ?? null,
              }),
            }
          )
        )
      )
      isDirtyRef.current = false
      setIsDirty(false)
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus('idle'), 2500)
    } catch {
      setSaveStatus('dirty')
    }
  }, [dealId])

  function triggerAutoSave() {
    setIsDirty(true)
    isDirtyRef.current = true
    setSaveStatus('dirty')
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current)
    // Capture the quote ID at edit time so a quote switch before the timer fires
    // doesn't cause the wrong quote to be saved.
    const qId = selectedQuoteIdRef.current
    autoSaveTimerRef.current = setTimeout(() => doSave(qId), 1500)
  }

  function updateItemField(
    itemId: string,
    updates: Partial<QuoteItemData>
  ) {
    setQuotes(prev =>
      prev.map(q =>
        q.id === selectedQuoteId
          ? {
              ...q,
              items: q.items.map(i =>
                i.id === itemId ? { ...i, ...updates } : i
              ),
            }
          : q
      )
    )
    triggerAutoSave()
  }

  // ── DnD ──────────────────────────────────────────────────────────────────

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id || !selectedQuoteId) return
    const items = selectedQuote?.items ?? []
    const oldIdx = items.findIndex(i => i.id === active.id)
    const newIdx = items.findIndex(i => i.id === over.id)
    const reordered = arrayMove(items, oldIdx, newIdx).map((item, idx) => ({
      ...item,
      poradi: idx,
    }))
    setQuotes(prev =>
      prev.map(q =>
        q.id === selectedQuoteId ? { ...q, items: reordered } : q
      )
    )
    try {
      const res = await fetch(
        `/api/deals/${dealId}/quotes/${selectedQuoteId}/items/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: reordered.map(i => ({ id: i.id, poradi: i.poradi })),
          }),
        }
      )
      if (!res.ok) {
        setQuotes(prev => prev.map(q => q.id === selectedQuoteId ? { ...q, items } : q))
        showError('Pořadí se nepodařilo uložit')
      }
    } catch {
      setQuotes(prev => prev.map(q => q.id === selectedQuoteId ? { ...q, items } : q))
      showError('Pořadí se nepodařilo uložit')
    }
  }

  // ── Quote management ──────────────────────────────────────────────────────

  async function createQuote() {
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dphSazba: dealDph }),
      })
      if (res.ok) {
        const q = await res.json()
        setQuotes(prev => [
          ...prev,
          { ...q, items: [], popis: q.popis ?? '', dphSazba: q.dphSazba },
        ])
        setSelectedQuoteId(q.id)
      }
    } finally {
      setSaving(false)
    }
  }

  async function applyTemplate(tplId: string) {
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) return
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: tpl.nazev,
          dphSazba: dealDph,
          items: tpl.polozky.map((p, idx) => ({
            productId: p.product_id || null,
            nazev: p.nazev,
            mnozstvi: Number(p.mnozstvi),
            cenaZaKus: Number(p.cena_za_kus),
            jednotka: p.jednotka || 'ks',
            poznamky: p.poznamky || null,
            poradi: idx,
          })),
        }),
      })
      if (res.ok) {
        const q = await res.json()
        setQuotes(prev => [
          ...prev,
          { ...q, popis: q.popis ?? '', dphSazba: q.dphSazba },
        ])
        setSelectedQuoteId(q.id)
      }
    } finally {
      setSaving(false)
    }
  }

  async function setActive(quoteId: string) {
    const prevQuotes = quotes
    setQuotes(prev => prev.map(q => ({ ...q, aktivni: q.id === quoteId })))
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktivni: true }),
    })
    if (res.ok) {
      router.refresh()
    } else {
      setQuotes(prevQuotes)
      showError('Nepodařilo se aktivovat nabídku')
    }
  }

  async function duplicateQuote(quoteId: string) {
    setSaving(true)
    try {
      const res = await fetch(
        `/api/deals/${dealId}/quotes/${quoteId}/duplicate`,
        { method: 'POST' }
      )
      if (res.ok) {
        const q = await res.json()
        setQuotes(prev => [
          ...prev,
          { ...q, popis: q.popis ?? '', dphSazba: q.dphSazba },
        ])
        setSelectedQuoteId(q.id)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteQuoteConfirm() {
    if (!deleteQuoteId) return
    const res = await fetch(`/api/deals/${dealId}/quotes/${deleteQuoteId}`, { method: 'DELETE' })
    if (res.ok) {
      const remaining = quotes.filter(q => q.id !== deleteQuoteId)
      setQuotes(remaining)
      setSelectedQuoteId(remaining[0]?.id ?? null)
    } else {
      showError('Nabídku se nepodařilo smazat')
    }
    setDeleteQuoteId(null)
  }

  async function renameQuote(quoteId: string) {
    if (!renameVal.trim()) { setRenamingId(null); return }
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: renameVal }),
    })
    if (res.ok) {
      setQuotes(prev => prev.map(q => (q.id === quoteId ? { ...q, nazev: renameVal } : q)))
    } else {
      showError('Přejmenování se nepodařilo uložit')
    }
    setRenamingId(null)
  }

  async function saveNameEdit(quoteId: string) {
    if (!editingNameValue.trim()) { setEditingNameId(null); return }
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nazev: editingNameValue }),
    })
    if (res.ok) {
      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, nazev: editingNameValue } : q))
    } else {
      showError('Přejmenování se nepodařilo uložit')
    }
    setEditingNameId(null)
  }

  async function updateQuoteDph(quoteId: string, dphSazba: number) {
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dphSazba }),
    })
    if (res.ok) {
      setQuotes(prev => prev.map(q => (q.id === quoteId ? { ...q, dphSazba } : q)))
    } else {
      showError('Nepodařilo se uložit sazbu DPH')
    }
  }

  async function updateQuoteTemplate(quoteId: string, templateId: string | null) {
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: templateId ?? '' }),
    })
    if (res.ok) {
      setQuotes(prev => prev.map(q => (q.id === quoteId ? { ...q, templateId } : q)))
    } else {
      showError('Nepodařilo se uložit šablonu')
    }
  }

  async function handleExportPdf(quoteId: string) {
    setPdfLoading(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/export-pdf`, {
        method: 'POST',
      })
      if (!res.ok) {
        showToast('Chyba při generování PDF')
        return
      }
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? `Nabidka-${quoteId}.pdf`
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  async function updateQuotePopis(quoteId: string, popis: string) {
    const res = await fetch(`/api/deals/${dealId}/quotes/${quoteId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ popis }),
    })
    if (res.ok) {
      setQuotes(prev => prev.map(q => (q.id === quoteId ? { ...q, popis } : q)))
    } else {
      showError('Poznámku se nepodařilo uložit')
    }
  }

  async function addMultipleItems(
    items: {
      productId: string
      nazev: string
      cenaZaKus: number
      mnozstvi: number
      jednotka?: string
    }[]
  ) {
    if (!selectedQuoteId || items.length === 0) return
    setShowProductModal(false)
    setSaving(true)
    try {
      const existingItems = selectedQuote?.items ?? []
      const basePoradi =
        existingItems.reduce((max, i) => Math.max(max, i.poradi ?? 0), -1) +
        1
      const res = await fetch(
        `/api/deals/${dealId}/quotes/${selectedQuoteId}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items: items.map((item, idx) => ({
              ...item,
              jednotka: item.jednotka || 'ks',
              sleva: 0,
              poradi: basePoradi + idx,
            })),
          }),
        }
      )
      if (res.ok) {
        const created = await res.json()
        const newItems = (Array.isArray(created) ? created : [created]).map(
          normalizeItem
        )
        setQuotes(prev =>
          prev.map(q =>
            q.id === selectedQuoteId
              ? { ...q, items: [...q.items, ...newItems] }
              : q
          )
        )
      }
    } finally {
      setSaving(false)
    }
  }

  async function addInlineItem() {
    if (!selectedQuoteId) return
    setSaving(true)
    try {
      const existingItems = selectedQuote?.items ?? []
      const maxPoradi = existingItems.reduce(
        (max, i) => Math.max(max, i.poradi ?? 0),
        -1
      )
      const res = await fetch(
        `/api/deals/${dealId}/quotes/${selectedQuoteId}/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            nazev: '',
            mnozstvi: 1,
            cenaZaKus: 0,
            jednotka: 'ks',
            sleva: 0,
            poradi: maxPoradi + 1,
          }),
        }
      )
      if (res.ok) {
        const item = await res.json()
        const newItem = normalizeItem(item)
        const newIdx = existingItems.length
        setQuotes(prev =>
          prev.map(q =>
            q.id === selectedQuoteId
              ? { ...q, items: [...q.items, newItem] }
              : q
          )
        )
        setTimeout(() => {
          const input = document.querySelector(
            `[data-row="${newIdx}"][data-field="nazev"]`
          ) as HTMLInputElement | null
          input?.focus()
          input?.select()
        }, 60)
      }
    } finally {
      setSaving(false)
    }
  }

  async function deleteItemConfirm() {
    if (!selectedQuoteId || !deleteItemId) return
    const res = await fetch(
      `/api/deals/${dealId}/quotes/${selectedQuoteId}/items/${deleteItemId}`,
      { method: 'DELETE' }
    )
    if (res.ok) {
      setQuotes(prev =>
        prev.map(q =>
          q.id === selectedQuoteId
            ? { ...q, items: q.items.filter(i => i.id !== deleteItemId) }
            : q
        )
      )
    } else {
      showError('Položku se nepodařilo smazat')
    }
    setDeleteItemId(null)
  }

  function formatCena(val: number) {
    return val.toLocaleString('cs-CZ', { maximumFractionDigits: 2 })
  }

  async function moveItem(itemId: string, dir: 'up' | 'down') {
    if (!selectedQuoteId || !selectedQuote) return
    const items = selectedQuote.items
    const idx = items.findIndex(i => i.id === itemId)
    if (idx === -1) return
    const newIdx = dir === 'up' ? idx - 1 : idx + 1
    if (newIdx < 0 || newIdx >= items.length) return
    const reordered = arrayMove(items, idx, newIdx).map((item, i) => ({ ...item, poradi: i }))
    setQuotes(prev => prev.map(q => q.id === selectedQuoteId ? { ...q, items: reordered } : q))
    try {
      const res = await fetch(
        `/api/deals/${dealId}/quotes/${selectedQuoteId}/items/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: reordered.map(i => ({ id: i.id, poradi: i.poradi })) }),
        }
      )
      if (!res.ok) {
        setQuotes(prev => prev.map(q => q.id === selectedQuoteId ? { ...q, items } : q))
        showError('Pořadí se nepodařilo uložit')
      }
    } catch {
      setQuotes(prev => prev.map(q => q.id === selectedQuoteId ? { ...q, items } : q))
      showError('Pořadí se nepodařilo uložit')
    }
  }

  const selectInp =
    'border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white'

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={deleteQuoteId !== null}
        title="Smazat nabídku"
        message="Smazat tuto nabídku? Tato akce je nevratná."
        confirmLabel="Smazat"
        danger
        onConfirm={deleteQuoteConfirm}
        onCancel={() => setDeleteQuoteId(null)}
      />
      <ConfirmModal
        isOpen={deleteItemId !== null}
        title="Smazat položku"
        message="Smazat tuto položku?"
        confirmLabel="Smazat"
        danger
        onConfirm={deleteItemConfirm}
        onCancel={() => setDeleteItemId(null)}
      />
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 text-white text-sm font-medium px-4 py-2.5 rounded-lg shadow-lg ${toastType === 'error' ? 'bg-red-600' : 'bg-green-600'}`}>
          {toast}
        </div>
      )}

      {showProductModal && (
        <ProductCatalogModal
          onClose={() => setShowProductModal(false)}
          onAdd={addMultipleItems}
        />
      )}

      {showDuplicateToModal && selectedQuote && (
        <DuplicateToModal
          dealId={dealId}
          quoteId={selectedQuote.id}
          quoteName={selectedQuote.nazev}
          onClose={() => setShowDuplicateToModal(false)}
          onSuccess={() => showToast('Nabídka zkopírována')}
        />
      )}

      {/* Quote tabs */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {quotes.map(q => (
            <button
              key={q.id}
              onClick={() => setSelectedQuoteId(q.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                selectedQuoteId === q.id
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500'
              }`}
            >
              {q.aktivni && (
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 flex-shrink-0" />
              )}
              {renamingId === q.id ? (
                <input
                  autoFocus
                  value={renameVal}
                  onChange={e => setRenameVal(e.target.value)}
                  onBlur={() => renameQuote(q.id)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') renameQuote(q.id)
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={e => e.stopPropagation()}
                  className="bg-transparent border-none outline-none w-28 text-white placeholder-white/70"
                />
              ) : (
                <span
                  onDoubleClick={e => {
                    e.stopPropagation()
                    setRenamingId(q.id)
                    setRenameVal(q.nazev)
                  }}
                >
                  {q.kod && (
                    <span className="font-mono text-xs opacity-70 mr-1">
                      {q.kod}
                    </span>
                  )}
                  {q.nazev}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={createQuote}
            disabled={saving}
            className="text-sm text-primary dark:text-primary-light hover:text-blue-800 dark:hover:text-blue-300 border border-blue-300 dark:border-blue-700 hover:border-primary-light px-3 py-1.5 rounded-lg"
          >
            + Nová nabídka
          </button>
          {templates.length > 0 && (
            <select
              onChange={e => {
                if (e.target.value) applyTemplate(e.target.value)
                e.target.value = ''
              }}
              className={`${selectInp} py-1.5`}
            >
              <option value="">Použít šablonu…</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>
                  {t.nazev}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      {quotes.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-10 text-center text-sm text-gray-400 dark:text-slate-500">
          Žádné nabídky. Vytvořte první cenovou nabídku.
        </div>
      )}

      {selectedQuote && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Mobile header */}
          <div className="flex items-center justify-between px-4 pt-3 pb-1 md:hidden">
            <div>
              {selectedQuote.kod && (
                <span className="font-mono text-xs text-green-400">{selectedQuote.kod}</span>
              )}
              <h3 className="font-semibold text-white text-base">{selectedQuote.nazev}</h3>
            </div>
            <div className="flex items-center gap-2">
              {selectedQuote.aktivni && (
                <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                  Aktivní
                </span>
              )}
              <button
                onClick={() => setMoreOpen(true)}
                className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white"
              >
                ⋯
              </button>
            </div>
          </div>

          {/* Quote header — desktop only */}
          <div className="px-4 py-3 border-b border-gray-100 dark:border-slate-700 hidden md:flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {editingNameId === selectedQuote.id ? (
                  <input
                    autoFocus
                    value={editingNameValue}
                    onChange={e => setEditingNameValue(e.target.value)}
                    onBlur={() => saveNameEdit(selectedQuote.id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveNameEdit(selectedQuote.id)
                      if (e.key === 'Escape') setEditingNameId(null)
                    }}
                    className="border border-blue-400 rounded px-2 py-0.5 text-sm font-semibold bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                ) : (
                  <span
                    onClick={() => {
                      setEditingNameId(selectedQuote.id)
                      setEditingNameValue(selectedQuote.nazev)
                    }}
                    className="cursor-pointer hover:text-primary dark:hover:text-primary-light"
                    title="Klikněte pro přejmenování"
                  >
                    {selectedQuote.nazev}
                  </span>
                )}
              </h3>
              {selectedQuote.kod && (
                <span className="font-mono text-sm font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">
                  {selectedQuote.kod}
                </span>
              )}
              {selectedQuote.aktivni ? (
                <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full font-medium">
                  Aktivní
                </span>
              ) : (
                <button
                  onClick={() => setActive(selectedQuote.id)}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-green-700 border border-gray-300 dark:border-slate-600 hover:border-green-400 px-2 py-0.5 rounded-full"
                >
                  Nastavit jako aktivní
                </button>
              )}
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-500 dark:text-slate-400">
                  DPH:
                </span>
                <select
                  value={selectedQuote.dphSazba}
                  onChange={e =>
                    updateQuoteDph(selectedQuote.id, Number(e.target.value))
                  }
                  className="text-xs border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value={12}>12 %</option>
                  <option value={21}>21 %</option>
                </select>
              </div>
              {renderTemplates.length > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 dark:text-slate-400">
                    Šablona:
                  </span>
                  <select
                    value={selectedQuote.templateId ?? ''}
                    onChange={e =>
                      updateQuoteTemplate(selectedQuote.id, e.target.value || null)
                    }
                    className="text-xs border border-gray-300 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary max-w-[140px]"
                  >
                    <option value="">Výchozí</option>
                    {renderTemplates.map(t => (
                      <option key={t.id} value={t.id}>
                        {t.nazev}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Save status indicator */}
              {saveStatus !== 'idle' && (
                <span
                  className={`text-xs ${
                    saveStatus === 'saving'
                      ? 'text-amber-500 dark:text-amber-400'
                      : saveStatus === 'saved'
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-400 dark:text-slate-500'
                  }`}
                >
                  {saveStatus === 'saving'
                    ? 'Ukládám…'
                    : saveStatus === 'saved'
                    ? '✓ Uloženo'
                    : '●'}
                </span>
              )}
              <button
                onClick={() => doSave()}
                disabled={!isDirty || saveStatus === 'saving'}
                className="text-xs text-white bg-primary hover:bg-primary-hover disabled:opacity-40 px-2.5 py-1 rounded-lg"
              >
                Uložit
              </button>
              <button
                onClick={() => duplicateQuote(selectedQuote.id)}
                disabled={saving}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200"
              >
                Duplikovat
              </button>
              <button
                onClick={() => setShowDuplicateToModal(true)}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 border border-indigo-300 dark:border-indigo-700 hover:border-indigo-400 px-2 py-0.5 rounded"
              >
                Duplikovat →
              </button>
              <a
                href={`/api/quotes/${selectedQuote.id}/preview`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 border border-emerald-300 dark:border-emerald-700 px-2.5 py-1 rounded-lg"
              >
                Náhled
              </a>
              <button
                onClick={() => handleExportPdf(selectedQuote.id)}
                disabled={pdfLoading}
                className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-white border border-gray-300 dark:border-slate-600 px-2.5 py-1 rounded-lg disabled:opacity-50"
              >
                {pdfLoading ? 'Generuji…' : '⬇ PDF'}
              </button>
              {quotes.length > 1 && (
                <button
                  onClick={() => setDeleteQuoteId(selectedQuote.id)}
                  className="text-xs text-red-400 hover:text-red-600"
                >
                  Smazat
                </button>
              )}
              <button
                onClick={() => setShowProductModal(true)}
                className="flex items-center gap-1.5 bg-primary hover:bg-primary-hover text-white text-xs font-medium px-2.5 py-1.5 rounded-lg"
              >
                <svg
                  className="w-3 h-3"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Z katalogu
              </button>
              <button
                onClick={addInlineItem}
                disabled={saving}
                className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-slate-300 border border-gray-300 dark:border-slate-600 hover:bg-gray-50 dark:hover:bg-slate-700 px-2.5 py-1.5 rounded-lg disabled:opacity-50"
              >
                + Přidat položku
              </button>
            </div>
          </div>

          {/* Popis */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-slate-700">
            <textarea
              value={selectedQuote.popis}
              onChange={e =>
                setQuotes(prev =>
                  prev.map(q =>
                    q.id === selectedQuote.id
                      ? { ...q, popis: e.target.value }
                      : q
                  )
                )
              }
              onBlur={e => updateQuotePopis(selectedQuote.id, e.target.value)}
              rows={1}
              placeholder="Popis nabídky (volitelné)…"
              className="w-full text-sm text-gray-700 dark:text-white bg-transparent border-none outline-none resize-none placeholder-gray-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Mobile card layout */}
          {isMobile && (
            <div className="px-4 pt-3 md:hidden">
              {selectedQuote.items.length === 0 && (
                <p className="text-center text-sm text-green-400/60 py-6">
                  Žádné položky. Přidejte položku nebo vyberte z katalogu.
                </p>
              )}
              <div className="space-y-2 mb-4">
                {selectedQuote.items.map((item, idx) => {
                  const celkem = Number(item.cenaZaKus) * Number(item.mnozstvi) * (1 - Number(item.sleva || 0) / 100)
                  return (
                    <div key={item.id}
                      className="bg-white/5 border border-green-900/30 rounded-xl p-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0">
                          <input
                            value={item.nazev}
                            onChange={e => updateItemField(item.id, { nazev: e.target.value })}
                            className="font-semibold text-white text-sm bg-transparent border-b border-transparent focus:border-green-500 outline-none w-full"
                            placeholder="Název položky"
                            style={{ fontSize: 16 }}
                          />
                        </div>
                        <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                          <div className="flex gap-1">
                            <button
                              onClick={() => moveItem(item.id, 'up')}
                              disabled={idx === 0}
                              className="text-green-400/40 hover:text-green-400 disabled:opacity-20 p-1 text-sm"
                            >↑</button>
                            <button
                              onClick={() => moveItem(item.id, 'down')}
                              disabled={idx === selectedQuote.items.length - 1}
                              className="text-green-400/40 hover:text-green-400 disabled:opacity-20 p-1 text-sm"
                            >↓</button>
                          </div>
                          <button
                            onClick={() => setDeleteItemId(item.id)}
                            className="text-red-400 p-1"
                          >×</button>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <div>
                          <label className="text-xs text-green-400/60 uppercase tracking-wide">Množství</label>
                          <input
                            type="number"
                            value={item.mnozstvi}
                            onChange={e => updateItemField(item.id, { mnozstvi: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm text-right border border-transparent focus:border-green-500 outline-none mt-1"
                            style={{ fontSize: 16 }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-green-400/60 uppercase tracking-wide">Jednotka</label>
                          <input
                            value={item.jednotka || 'ks'}
                            onChange={e => updateItemField(item.id, { jednotka: e.target.value })}
                            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm border border-transparent focus:border-green-500 outline-none mt-1"
                            style={{ fontSize: 16 }}
                          />
                        </div>
                        <div>
                          <label className="text-xs text-green-400/60 uppercase tracking-wide">Cena / ks</label>
                          <input
                            type="number"
                            value={item.cenaZaKus}
                            onChange={e => updateItemField(item.id, { cenaZaKus: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm text-right border border-transparent focus:border-green-500 outline-none mt-1"
                            style={{ fontSize: 16 }}
                          />
                        </div>
                        {isManazer && (
                          <div>
                            <label className="text-xs text-green-400/60 uppercase tracking-wide">NK. cena</label>
                            <input
                              type="number"
                              value={item.nakupniCena ?? ''}
                              placeholder="= prodejní"
                              onChange={e => updateItemField(item.id, {
                                nakupniCena: e.target.value === '' ? null : (parseFloat(e.target.value) || 0),
                              })}
                              className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm text-right border border-transparent focus:border-green-500 outline-none mt-1"
                              style={{ fontSize: 16 }}
                            />
                          </div>
                        )}
                        <div>
                          <label className="text-xs text-green-400/60 uppercase tracking-wide">DPH %</label>
                          <select
                            value={item.dphSazba}
                            onChange={e => updateItemField(item.id, { dphSazba: Number(e.target.value) })}
                            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm border border-transparent focus:border-green-500 outline-none mt-1"
                            style={{ fontSize: 16 }}
                          >
                            <option value={0}>0 %</option>
                            <option value={12}>12 %</option>
                            <option value={21}>21 %</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs text-green-400/60 uppercase tracking-wide">Sleva %</label>
                          <input
                            type="number"
                            value={item.sleva || 0}
                            onChange={e => updateItemField(item.id, { sleva: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-white/10 rounded-lg px-3 py-2 text-white text-sm text-right border border-transparent focus:border-green-500 outline-none mt-1"
                            style={{ fontSize: 16 }}
                          />
                        </div>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-green-900/20">
                        <span className="text-xs text-green-400/60">Celkem</span>
                        <span className="font-semibold text-green-400 text-sm">
                          {formatCena(celkem)} Kč
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Mobile souhrn cen */}
              <div className="bg-[#0D1A0E] border border-green-900/30 rounded-xl p-4 mb-20">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-green-400/60">Bez DPH</span>
                  <span className="text-white">{formatCena(total)} Kč</span>
                </div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-green-400/60">DPH {dphRate} %</span>
                  <span className="text-white">{formatCena(totalDph - total)} Kč</span>
                </div>
                <div className="flex justify-between font-bold border-t border-green-900/30 pt-2">
                  <span className="text-green-400">Celkem s DPH</span>
                  <span className="text-green-400 text-lg">{formatCena(totalDph)} Kč</span>
                </div>
                {marzeQuote && isManazer && (
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t border-green-900/20">
                    <span className="text-green-400/60">Marže</span>
                    <span className={marzeQuote.proc >= 20 ? 'text-green-400 font-semibold' : 'text-red-400 font-semibold'}>
                      {marzeQuote.proc.toFixed(1)} % ({formatCena(marzeQuote.kc)} Kč)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Items table — desktop only */}
          <div className="hidden md:block">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-slate-900/60 border-b border-gray-100 dark:border-slate-700">
                  <tr>
                    <th className="w-6" />
                    <th
                      className="text-left text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 84 }}
                    >
                      Kód
                    </th>
                    <th className="text-left text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide">
                      Název
                    </th>
                    <th
                      className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 68 }}
                    >
                      Mn.
                    </th>
                    <th
                      className="text-left text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 64 }}
                    >
                      Jed.
                    </th>
                    <th
                      className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 96 }}
                    >
                      Cena/ks
                    </th>
                    {isManazer && (
                      <th
                        className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                        style={{ width: 88 }}
                      >
                        NK. cena
                      </th>
                    )}
                    <th
                      className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 64 }}
                    >
                      Sleva%
                    </th>
                    <th
                      className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase px-2 py-1.5 tracking-wide"
                      style={{ width: 60 }}
                    >
                      DPH%
                    </th>
                    <th
                      className="text-right text-[11px] font-semibold text-gray-400 dark:text-slate-500 uppercase pr-2 py-1.5 tracking-wide"
                      style={{ width: 96 }}
                    >
                      Celkem
                    </th>
                    <th style={{ width: 28 }} />
                  </tr>
                </thead>
                <tbody>
                  {selectedQuote.items.length === 0 && (
                    <tr>
                      <td
                        colSpan={isManazer ? 11 : 10}
                        className="py-8 text-center text-sm text-gray-400 dark:text-slate-500"
                      >
                        Žádné položky.{' '}
                        <button
                          onClick={() => setShowProductModal(true)}
                          className="text-blue-600 hover:underline"
                        >
                          Z katalogu
                        </button>{' '}
                        nebo{' '}
                        <button
                          onClick={addInlineItem}
                          className="text-blue-600 hover:underline"
                        >
                          přidat vlastní
                        </button>
                      </td>
                    </tr>
                  )}
                  <SortableContext
                    items={selectedQuote.items.map(i => i.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {selectedQuote.items.map((item, idx) => (
                      <SortableRow
                        key={item.id}
                        item={item}
                        idx={idx}
                        onUpdate={updateItemField}
                        onDelete={setDeleteItemId}
                        isManazer={isManazer}
                      />
                    ))}
                  </SortableContext>
                </tbody>
                <tfoot className="border-t-2 border-gray-200 dark:border-slate-600 bg-gray-50 dark:bg-slate-900/60">
                  <tr>
                    <td
                      colSpan={isManazer ? 9 : 8}
                      className="px-4 py-2 text-sm text-right text-gray-600 dark:text-slate-400"
                    >
                      Celkem bez DPH:
                    </td>
                    <td className="pr-2 py-2 text-right text-base font-bold text-gray-900 dark:text-white tabular-nums">
                      {total.toLocaleString('cs-CZ', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      Kč
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td
                      colSpan={isManazer ? 9 : 8}
                      className="px-4 py-1 text-sm text-right text-gray-500 dark:text-slate-400"
                    >
                      DPH {dphRate}%:
                    </td>
                    <td className="pr-2 py-1 text-right text-sm text-gray-600 dark:text-slate-300 tabular-nums">
                      {(totalDph - total).toLocaleString('cs-CZ', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      Kč
                    </td>
                    <td />
                  </tr>
                  <tr>
                    <td
                      colSpan={isManazer ? 9 : 8}
                      className="px-4 py-2 text-sm font-semibold text-right text-blue-700 dark:text-blue-400"
                    >
                      Celkem s DPH:
                    </td>
                    <td className="pr-2 py-2 text-right text-xl font-bold text-blue-700 dark:text-blue-400 tabular-nums">
                      {totalDph.toLocaleString('cs-CZ', {
                        maximumFractionDigits: 2,
                      })}{' '}
                      Kč
                    </td>
                    <td />
                  </tr>
                  {marzeQuote && (
                    <tr className="border-t border-gray-100 dark:border-slate-700">
                      <td
                        colSpan={isManazer ? 9 : 8}
                        className="px-4 py-1.5 text-xs text-right text-gray-400 dark:text-slate-500"
                      >
                        Marže:
                      </td>
                      <td className={`pr-2 py-1.5 text-right text-xs font-semibold tabular-nums ${
                        marzeQuote.proc >= 20 ? 'text-green-600 dark:text-green-400' :
                        'text-red-600 dark:text-red-400'
                      }`}>
                        {marzeQuote.proc.toFixed(1)} % ({marzeQuote.kc.toLocaleString('cs-CZ', { maximumFractionDigits: 0 })} Kč)
                      </td>
                      <td />
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </DndContext>
          </div>{/* end hidden md:block */}
        </div>
      )}

      {/* Mobile sticky bottom bar */}
      {selectedQuote && isMobile && (
        <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
          <div className="bg-[#0D1A0E] border border-green-900/50 rounded-2xl p-3 flex gap-2 shadow-xl">
            <button
              onClick={addInlineItem}
              disabled={saving}
              className="flex-1 bg-white/10 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>+</span> Přidat
            </button>
            <button
              onClick={() => setShowProductModal(true)}
              className="flex-1 bg-green-500 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
            >
              Katalog
            </button>
            <button
              onClick={() => setMoreOpen(true)}
              className="w-12 bg-white/10 text-white rounded-xl py-3 text-sm font-medium flex items-center justify-center"
            >
              ⋯
            </button>
          </div>
        </div>
      )}

      {/* Mobile bottom sheet */}
      {moreOpen && selectedQuote && isMobile && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60" onClick={() => setMoreOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0D1A0E] border-t border-green-900/50 rounded-t-2xl p-4 pb-8">
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-4" />
            <div className="space-y-1">
              {([
                { label: 'Uložit', icon: 'save', action: () => { doSave(); setMoreOpen(false) } },
                { label: 'Náhled PDF', icon: 'eye', action: () => { window.open(`/api/quotes/${selectedQuote.id}/preview`, '_blank'); setMoreOpen(false) } },
                { label: 'Stáhnout PDF', icon: 'download', action: () => { handleExportPdf(selectedQuote.id); setMoreOpen(false) } },
                { label: 'Duplikovat nabídku', icon: 'copy', action: () => { duplicateQuote(selectedQuote.id); setMoreOpen(false) } },
                ...(!selectedQuote.aktivni ? [{ label: 'Nastavit jako aktivní', icon: 'check', action: () => { setActive(selectedQuote.id); setMoreOpen(false) } }] : []),
              ] as { label: string; icon: string; action: () => void }[]).map(item => (
                <button
                  key={item.label}
                  onClick={item.action}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-white/5 text-left transition-colors"
                >
                  <SheetIcon name={item.icon} />
                  <span className="text-white text-sm font-medium">{item.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 pt-4 border-t border-green-900/30 flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-green-400/60">DPH:</span>
                <select
                  value={selectedQuote.dphSazba}
                  onChange={e => updateQuoteDph(selectedQuote.id, Number(e.target.value))}
                  className="bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-green-900/30 outline-none"
                >
                  <option value="0">0 %</option>
                  <option value="12">12 %</option>
                  <option value="21">21 %</option>
                </select>
              </div>
              {renderTemplates.length > 0 && (
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-xs text-green-400/60 flex-shrink-0">Šablona:</span>
                  <select
                    value={selectedQuote.templateId ?? ''}
                    onChange={e => updateQuoteTemplate(selectedQuote.id, e.target.value || null)}
                    className="bg-white/10 text-white text-sm rounded-lg px-2 py-1 border border-green-900/30 outline-none flex-1 min-w-0"
                  >
                    <option value="">Výchozí</option>
                    {renderTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.nazev}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
