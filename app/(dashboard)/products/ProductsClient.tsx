'use client'

import { toast } from 'sonner'
import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import CenikDetail from './CenikDetail'
import { ResizeHandle } from '@/components/ResizeHandle'
import { formatDate, formatCislo } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'

const PROD_DEFS: ColumnDef[] = [
  { id: 'kod', label: 'Kód', defaultVisible: true, defaultWidth: 100 },
  { id: 'nazev', label: 'Název', defaultVisible: true, defaultWidth: 220 },
  { id: 'kategorie', label: 'Kategorie', defaultVisible: true, defaultWidth: 150 },
  { id: 'nakCena', label: 'Nák. cena', defaultVisible: true, defaultWidth: 120 },
  { id: 'stdCena', label: 'Stand. cena', defaultVisible: true, defaultWidth: 120 },
  { id: 'marze', label: 'Marže %', defaultVisible: true, defaultWidth: 90 },
  { id: 'dph', label: 'DPH', defaultVisible: true, defaultWidth: 70 },
  { id: 'sklad', label: 'Na skladě', defaultVisible: true, defaultWidth: 110 },
  { id: 'aktivni', label: 'Aktivní', defaultVisible: true, defaultWidth: 80 },
]


interface ProductCategory { id: string; nazev: string; barva: string }
interface Product {
  id: string; kod: string | null; nazev: string; produktovaRada: string | null
  categories: ProductCategory[]; jednotka: string
  popis: string | null; dphSazba: number; nakladovaCena: number | null
  standardniCena: number; aktivni: boolean
  naSklade: number; dostupne: number; minMnozstvi: number | null
}
interface Category { id: string; nazev: string; barva: string }
interface Cenik { id: string; kod: string; nazev: string; popis: string | null; aktivni: boolean; _count: { polozky: number }; vytvoreno: string }

interface Props { products: Product[]; categories: Category[]; ceniky: Cenik[]; isAdmin: boolean; showNakladoveCeny?: boolean; showSklad?: boolean }

function fmt(n: number) { return formatCislo(n) }

function marze(nak: number | null, std: number): number | null {
  if (!nak || nak <= 0 || std <= 0) return null
  return ((std - nak) / std) * 100
}

function MarzeChip({ value }: { value: number | null }) {
  if (value === null) return <span className="text-gray-400 dark:text-slate-500 text-xs">—</span>
  const color =
    value >= 30 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
    : value >= 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
  return (
    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${color}`}>
      {value >= 0 ? '+' : ''}{value.toFixed(1)} %
    </span>
  )
}

// ─── PRODUCTS TAB ─────────────────────────────────────────────────────────────
function ProductsTab({ products, categories, showNakladoveCeny = true, showSklad = false, userId }: { products: Product[]; categories: Category[]; showNakladoveCeny?: boolean; showSklad?: boolean; userId: string }) {
  const router = useRouter()

  // Filter defs based on showNakladoveCeny
  const defs = PROD_DEFS.filter(d => (showNakladoveCeny || (d.id !== 'nakCena' && d.id !== 'marze')) && (showSklad || d.id !== 'sklad'))
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns('products', userId, defs)

  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingCell, setEditingCell] = useState<{ id: string; field: 'standardniCena' | 'nakladovaCena' } | null>(null)
  const [editingVal, setEditingVal] = useState('')
  const [localPrices, setLocalPrices] = useState<Record<string, { std?: number; nak?: number | null }>>({})
  const [bulkPercent, setBulkPercent] = useState('')
  const [bulkSaving, setBulkSaving] = useState(false)
  const editRef = useRef<HTMLInputElement>(null)

  const filtered = products.filter(p => {
    if (!showInactive && !p.aktivni) return false
    const q = search.toLowerCase()
    const matchSearch = !q || p.nazev.toLowerCase().includes(q) ||
      (p.kod ?? '').toLowerCase().includes(q) ||
      (p.produktovaRada ?? '').toLowerCase().includes(q)
    const matchCat = !catFilter || p.categories.some(c => c.id === catFilter)
    return matchSearch && matchCat
  })

  const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
  const catFilterOptions = [
    { value: '', label: 'Všechny kategorie' },
    ...categories.map(c => ({ value: c.id, label: c.nazev })),
  ]

  function getPrice(p: Product) {
    const local = localPrices[p.id]
    return {
      std: local?.std !== undefined ? local.std : p.standardniCena,
      nak: local?.nak !== undefined ? local.nak : p.nakladovaCena,
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  function toggleAll() {
    if (selected.size === filtered.length && filtered.length > 0) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map(p => p.id)))
    }
  }

  function startEdit(p: Product, field: 'standardniCena' | 'nakladovaCena', e: React.MouseEvent) {
    e.stopPropagation()
    const prices = getPrice(p)
    const current = field === 'standardniCena' ? prices.std : prices.nak
    setEditingCell({ id: p.id, field })
    setEditingVal(current !== null ? String(current) : '')
    setTimeout(() => editRef.current?.select(), 0)
  }

  async function commitEdit(p: Product) {
    if (!editingCell || editingCell.id !== p.id) return
    const val = editingVal === '' ? null : parseFloat(editingVal)
    if (val !== null && isNaN(val)) { setEditingCell(null); return }
    const field = editingCell.field
    setEditingCell(null)
    setLocalPrices(prev => ({
      ...prev,
      [p.id]: {
        ...prev[p.id],
        [field === 'standardniCena' ? 'std' : 'nak']: val,
      },
    }))
    await fetch(`/api/products/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: val }),
    })
    router.refresh()
  }

  async function applyBulkPriceChange() {
    const pct = parseFloat(bulkPercent)
    if (isNaN(pct)) return
    setBulkSaving(true)
    try {
      await Promise.all(Array.from(selected).map(async id => {
        const p = products.find(x => x.id === id)
        if (!p) return
        const prices = getPrice(p)
        const newStd = Math.round(prices.std * (1 + pct / 100) * 100) / 100
        setLocalPrices(prev => ({ ...prev, [id]: { ...prev[id], std: newStd } }))
        await fetch(`/api/products/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ standardniCena: newStd }),
        })
      }))
      setSelected(new Set())
      setBulkPercent('')
      router.refresh()
    } finally {
      setBulkSaving(false)
    }
  }

  const allSelected = filtered.length > 0 && selected.size === filtered.length

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat (název, kód, řada)…" className={`${inp} w-full sm:w-72`} />
        <div className="flex flex-wrap gap-3 items-center w-full sm:w-auto">
          <FilterDropdown value={catFilter} onChange={setCatFilter} options={catFilterOptions} className="flex-1 sm:flex-none" />
          <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer whitespace-nowrap">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} className="rounded" />
            Zobrazit neaktivní
          </label>
        </div>
        <div className="flex gap-2 w-full sm:w-auto sm:ml-auto items-center">
          <ColumnConfigButton
            columns={columns}
            defs={defs}
            onToggle={(id, vis) => updateColumn(id, { visible: vis })}
            onReorder={reorderColumns}
            onReset={resetColumns}
          />
          <Link href="/settings/import-products" className="flex-1 sm:flex-none text-center px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700">
            Import z XLSX
          </Link>
          <Link href="/products/new" className="flex-1 sm:flex-none text-center bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm">
            + Nový produkt
          </Link>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: 500 }}>
            <colgroup>
              <col style={{ width: 40 }} />
              {visibleColumns.map(col => (
                <col key={col.id} style={{ width: col.width ?? undefined }} />
              ))}
              <col style={{ width: 70 }} />
            </colgroup>
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                <th className="px-3 py-3">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                </th>
                {visibleColumns.map(col => (
                  <th key={col.id} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-3 whitespace-nowrap relative select-none">
                    {defs.find(d => d.id === col.id)?.label}
                    <ResizeHandle onResize={dx => resizeColumn(col.id, dx)} />
                  </th>
                ))}
                <th className="px-3 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.map(p => {
                const { std, nak } = getPrice(p)
                const m = marze(nak, std)
                const isEditingStd = editingCell?.id === p.id && editingCell.field === 'standardniCena'
                const isEditingNak = editingCell?.id === p.id && editingCell.field === 'nakladovaCena'
                return (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/products/${p.id}`)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/10 ${selected.has(p.id) ? 'bg-yellow-50 dark:bg-yellow-900/10' : ''} ${!p.aktivni ? 'opacity-60' : ''}`}
                  >
                    <td className="px-3 py-3" onClick={e => { e.stopPropagation(); toggleSelect(p.id) }}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                    </td>
                    {visibleColumns.map(col => {
                      switch (col.id) {
                        case 'kod':
                          return <td key={col.id} className="px-3 py-3 font-mono text-xs text-gray-500 dark:text-slate-400 overflow-hidden truncate">{p.kod ?? '—'}</td>
                        case 'nazev':
                          return (
                            <td key={col.id} className="px-3 py-3 overflow-hidden">
                              <p className="font-medium text-gray-900 dark:text-white truncate">{p.nazev}</p>
                              {p.produktovaRada && <p className="text-xs text-gray-400 dark:text-slate-500 truncate">{p.produktovaRada}</p>}
                            </td>
                          )
                        case 'kategorie':
                          return (
                            <td key={col.id} className="px-3 py-3 overflow-hidden">
                              {p.categories.length === 0
                                ? <span className="text-gray-300 dark:text-slate-600 text-xs">—</span>
                                : <div className="flex flex-wrap gap-1">
                                    {p.categories.map(c => (
                                      <span key={c.id} className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full font-medium text-white" style={{ backgroundColor: c.barva }}>
                                        {c.nazev}
                                      </span>
                                    ))}
                                  </div>
                              }
                            </td>
                          )
                        case 'nakCena':
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-3 whitespace-nowrap overflow-hidden"
                              onDoubleClick={e => startEdit(p, 'nakladovaCena', e)}
                              onClick={e => e.stopPropagation()}
                            >
                              {isEditingNak ? (
                                <input
                                  ref={editRef}
                                  type="number" min="0" step="0.01"
                                  value={editingVal}
                                  onChange={e => setEditingVal(e.target.value)}
                                  onBlur={() => commitEdit(p)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditingCell(null) }}
                                  className="w-28 border border-blue-400 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-gray-600 dark:text-slate-400 cursor-text" title="Dvojklik pro editaci">
                                  {nak !== null ? `${fmt(nak)} Kč` : <span className="text-gray-300 dark:text-slate-600">—</span>}
                                </span>
                              )}
                            </td>
                          )
                        case 'stdCena':
                          return (
                            <td
                              key={col.id}
                              className="px-3 py-3 whitespace-nowrap font-semibold overflow-hidden"
                              onDoubleClick={e => startEdit(p, 'standardniCena', e)}
                              onClick={e => e.stopPropagation()}
                            >
                              {isEditingStd ? (
                                <input
                                  ref={editRef}
                                  type="number" min="0" step="0.01"
                                  value={editingVal}
                                  onChange={e => setEditingVal(e.target.value)}
                                  onBlur={() => commitEdit(p)}
                                  onKeyDown={e => { if (e.key === 'Enter') commitEdit(p); if (e.key === 'Escape') setEditingCell(null) }}
                                  className="w-28 border border-blue-400 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none"
                                  autoFocus
                                />
                              ) : (
                                <span className="text-gray-900 dark:text-white cursor-text" title="Dvojklik pro editaci">
                                  {fmt(std)} Kč
                                </span>
                              )}
                            </td>
                          )
                        case 'marze':
                          return <td key={col.id} className="px-3 py-3"><MarzeChip value={m} /></td>
                        case 'dph':
                          return <td key={col.id} className="px-3 py-3 text-gray-600 dark:text-slate-400 whitespace-nowrap">{p.dphSazba} %</td>
                        case 'sklad': {
                          const podMin = p.minMnozstvi !== null && p.dostupne <= p.minMnozstvi
                          const cls = p.dostupne < 0 ? 'text-red-600 dark:text-red-400' : podMin ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-slate-300'
                          return (
                            <td key={col.id} className={`px-3 py-3 whitespace-nowrap ${cls}`} title={`Na skladě ${p.naSklade.toLocaleString('cs-CZ')} · dostupné ${p.dostupne.toLocaleString('cs-CZ')} ${p.jednotka}`}>
                              {p.naSklade === 0 && p.dostupne === 0 ? <span className="text-gray-400 dark:text-slate-500">—</span> : `${p.dostupne.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })} ${p.jednotka}`}
                            </td>
                          )
                        }
                        case 'aktivni':
                          return (
                            <td key={col.id} className="px-3 py-3">
                              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${p.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400'}`}>
                                {p.aktivni ? 'Aktivní' : 'Neakt.'}
                              </span>
                            </td>
                          )
                        default:
                          return <td key={col.id} />
                      }
                    })}
                    <td className="px-3 py-3 text-right">
                      <span className="text-xs text-green-600 dark:text-green-400">Detail →</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné produkty.</div>
        )}
      </div>

      {/* Bottom bar: count + bulk actions */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-xs text-gray-400 dark:text-slate-500">{filtered.length} produktů · dvojklik na cenu pro rychlou editaci</p>

        {selected.size > 0 && (
          <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl px-4 py-2.5 shadow-sm">
            <span className="text-sm text-gray-600 dark:text-slate-400 font-medium">{selected.size} vybraných</span>
            <span className="text-gray-300 dark:text-slate-600">|</span>
            <span className="text-sm text-gray-600 dark:text-slate-400">Změnit stand. cenu o</span>
            <input
              type="number"
              value={bulkPercent}
              onChange={e => setBulkPercent(e.target.value)}
              placeholder="0"
              className="w-16 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-center bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <span className="text-sm text-gray-600 dark:text-slate-400">%</span>
            <button
              onClick={applyBulkPriceChange}
              disabled={bulkSaving || !bulkPercent}
              className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white text-sm font-medium px-3 py-1.5 rounded-lg"
            >
              {bulkSaving ? 'Ukládám…' : 'Použít'}
            </button>
            <button onClick={() => setSelected(new Set())} className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
              Zrušit výběr
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CENÍKY TAB ───────────────────────────────────────────────────────────────
function CenikyTab({ ceniky, products, categories, isAdmin }: { ceniky: Cenik[]; products: Product[]; categories: Category[]; isAdmin: boolean }) {
  const [selectedCenik, setSelectedCenik] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)
  const [newForm, setNewForm] = useState({ kod: '', nazev: '', popis: '' })
  const [saving, setSaving] = useState(false)
  const [list, setList] = useState(ceniky)
  const [duplicating, setDuplicating] = useState<string | null>(null)
  const [dupForm, setDupForm] = useState<{ kod: string; nazev: string } | null>(null)

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  if (selectedCenik) {
    const cenik = list.find(c => c.id === selectedCenik)
    if (!cenik) return null
    return (
      <div>
        <button onClick={() => setSelectedCenik(null)} className="flex items-center gap-1 text-sm text-gray-500 dark:text-slate-400 hover:text-blue-600 mb-4">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Zpět na ceníky
        </button>
        <CenikDetail cenikId={selectedCenik} cenikNazev={cenik.nazev} cenikKod={cenik.kod} products={products} categories={categories} />
      </div>
    )
  }

  async function handleCreate() {
    if (!newForm.kod || !newForm.nazev) return
    setSaving(true)
    try {
      const res = await fetch('/api/ceniky', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newForm) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Chyba'); return }
      setList(prev => [...prev, { ...data, vytvoreno: data.vytvoreno ?? new Date().toISOString() }])
      setShowNew(false); setNewForm({ kod: '', nazev: '', popis: '' })
    } finally { setSaving(false) }
  }

  async function handleDuplicate(cenikId: string) {
    if (!dupForm) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ceniky/${cenikId}/duplicate`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(dupForm) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error || 'Chyba'); return }
      setList(prev => [...prev, { ...data, vytvoreno: data.vytvoreno ?? new Date().toISOString() }])
      setDuplicating(null); setDupForm(null)
    } finally { setSaving(false) }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-slate-400">{list.length} ceníků</p>
        {isAdmin && (
          <button onClick={() => setShowNew(true)} className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm">
            + Nový ceník
          </button>
        )}
      </div>

      {showNew && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white">Nový ceník</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Kód *</label>
              <input value={newForm.kod} onChange={e => setNewForm(f => ({ ...f, kod: e.target.value }))} className={inp} placeholder="CN-LOW_COST" /></div>
            <div><label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Název *</label>
              <input value={newForm.nazev} onChange={e => setNewForm(f => ({ ...f, nazev: e.target.value }))} className={inp} /></div>
          </div>
          <div><label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis</label>
            <input value={newForm.popis} onChange={e => setNewForm(f => ({ ...f, popis: e.target.value }))} className={inp} /></div>
          <div className="flex gap-2">
            <button onClick={handleCreate} disabled={saving || !newForm.kod || !newForm.nazev} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
              {saving ? 'Vytvářím…' : 'Vytvořit'}
            </button>
            <button onClick={() => setShowNew(false)} className="text-sm text-gray-500 px-4 py-2">Zrušit</button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {list.map(c => (
          <div key={c.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-mono text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">{c.kod}</span>
                <h3 className="font-semibold text-gray-900 dark:text-white mt-1">{c.nazev}</h3>
                {c.popis && <p className="text-xs text-gray-500 dark:text-slate-400">{c.popis}</p>}
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400">
              <span className="font-medium text-gray-900 dark:text-white">{c._count.polozky}</span> položek
              <span>·</span>
              {formatDate(c.vytvoreno)}
            </div>
            <div className="flex items-center gap-2 pt-1 border-t border-gray-100 dark:border-slate-700">
              <button onClick={() => setSelectedCenik(c.id)} className="flex-1 text-xs font-medium text-primary dark:text-primary-light hover:underline text-center py-1">
                Otevřít ceník →
              </button>
              {isAdmin && duplicating !== c.id && (
                <button onClick={() => { setDuplicating(c.id); setDupForm({ kod: `${c.kod}-COPY`, nazev: `${c.nazev} (kopie)` }) }} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 px-2 py-1">
                  Duplikovat
                </button>
              )}
              {duplicating === c.id && dupForm && (
                <div className="flex-1 space-y-2">
                  <input value={dupForm.kod} onChange={e => setDupForm(f => f ? { ...f, kod: e.target.value } : null)} className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white" placeholder="Nový kód" />
                  <input value={dupForm.nazev} onChange={e => setDupForm(f => f ? { ...f, nazev: e.target.value } : null)} className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white" placeholder="Nový název" />
                  <div className="flex gap-1">
                    <button onClick={() => handleDuplicate(c.id)} disabled={saving} className="text-xs text-green-600 font-medium">OK</button>
                    <button onClick={() => { setDuplicating(null); setDupForm(null) }} className="text-xs text-gray-500">Zrušit</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="col-span-3 text-center py-8 text-sm text-gray-400 dark:text-slate-500">Žádné ceníky. Importujte produkty z XLSX nebo vytvořte ceník ručně.</div>
        )}
      </div>
    </div>
  )
}

// ─── MAIN ──────────────────────────────────────────────────────────────────────
export default function ProductsClient({ products, categories, ceniky, isAdmin, showNakladoveCeny = true, showSklad = false }: Props) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const [tab, setTab] = useState<'produkty' | 'ceniky'>('produkty')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Produkty a ceníky</h1>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200 dark:border-slate-700">
        {(['produkty', 'ceniky'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === t ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400' : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'}`}>
            {t === 'produkty' ? `Produkty (${products.length})` : `Ceníky (${ceniky.length})`}
          </button>
        ))}
      </div>

      {tab === 'produkty' && <ProductsTab products={products} categories={categories} showNakladoveCeny={showNakladoveCeny} showSklad={showSklad} userId={userId} />}
      {tab === 'ceniky' && <CenikyTab ceniky={ceniky} products={products} categories={categories} isAdmin={isAdmin} />}
    </div>
  )
}
