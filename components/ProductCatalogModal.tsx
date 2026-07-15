'use client'

import { useState, useEffect, useRef } from 'react'
import { formatCislo } from '@/lib/format'
import { IconBox } from '@/components/ui/Icons'

interface CategoryData {
  id: string
  nazev: string
  barva: string
}

interface CatalogProduct {
  id: string
  kod: string | null
  nazev: string
  produktovaRada: string | null
  standardniCena: number
  dphSazba: number
  jednotka: string
  categories: { id: string; nazev: string; barva: string }[]
}

interface Props {
  onClose: () => void
  onAdd: (items: { productId: string; nazev: string; cenaZaKus: number; mnozstvi: number; jednotka?: string }[]) => void
}

export default function ProductCatalogModal({ onClose, onAdd }: Props) {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [lineFilter, setLineFilter] = useState('')
  const [cenikFilter, setCenikFilter] = useState('')
  const [sortBy, setSortBy] = useState<'kod' | 'nazev' | 'cena'>('kod')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(200)
  const [products, setProducts] = useState<CatalogProduct[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [linesMeta, setLinesMeta] = useState<{ produktovaRada: string | null; categoryIds: string[] }[]>([])
  const [selected, setSelected] = useState<Record<string, { qty: number; price: number; nazev: string; jednotka: string }>>({})
  const [categories, setCategories] = useState<CategoryData[]>([])
  const [cenikList, setCenikList] = useState<{ id: string; kod: string; nazev: string }[]>([])
  const [cenikPriceMap, setCenikPriceMap] = useState<Record<string, number>>({})
  const searchRef = useRef<HTMLInputElement>(null)

  // Focus on mount
  useEffect(() => { searchRef.current?.focus() }, [])

  // Fetch categories
  useEffect(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => setCategories(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Fetch ceník list
  useEffect(() => {
    fetch('/api/ceniky')
      .then(r => r.json())
      .then(data => setCenikList(Array.isArray(data) ? data : []))
      .catch(() => {})
  }, [])

  // Fetch ceník polozky when filter changes
  useEffect(() => {
    if (!cenikFilter) { setCenikPriceMap({}); return }
    fetch(`/api/ceniky/${cenikFilter}`)
      .then(r => r.json())
      .then(data => {
        const polozky: { productId: string; cena: number }[] = Array.isArray(data.polozky) ? data.polozky : []
        setCenikPriceMap(Object.fromEntries(polozky.map(p => [p.productId, Number(p.cena)])))
      })
      .catch(() => {})
  }, [cenikFilter])

  // Escape key
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setPage(1) }, 300)
    return () => clearTimeout(t)
  }, [search])

  // Reset page on filter changes
  useEffect(() => { setPage(1) }, [catFilter, lineFilter])

  // Fetch all product lines once for dropdowns
  useEffect(() => {
    fetch('/api/products?limit=9999&page=1')
      .then(r => r.json())
      .then(data => {
        const prods: CatalogProduct[] = Array.isArray(data) ? data : (data.products ?? [])
        setLinesMeta(prods.map(p => ({ produktovaRada: p.produktovaRada, categoryIds: p.categories.map((c: { id: string }) => c.id) })))
      })
      .catch(() => {})
  }, [])

  // Fetch products with current filters
  useEffect(() => {
    const params = new URLSearchParams()
    if (debouncedSearch) params.set('search', debouncedSearch)
    if (catFilter) params.set('categoryId', catFilter)
    if (lineFilter) params.set('productLine', lineFilter)
    params.set('page', String(page))
    params.set('limit', String(limit))

    setLoading(true)
    fetch(`/api/products?${params}`)
      .then(r => r.json())
      .then(data => {
        const prods: CatalogProduct[] = Array.isArray(data) ? data : (data.products ?? [])
        const t = Array.isArray(data) ? data.length : (data.total ?? data.length)
        const pg = Array.isArray(data) ? 1 : (data.pages ?? 1)
        setProducts(prods)
        setTotal(t)
        setTotalPages(pg)
      })
      .finally(() => setLoading(false))
  }, [debouncedSearch, catFilter, lineFilter, page, limit])

  // Available product lines filtered by category
  const availableLines = (() => {
    const filtered = catFilter ? linesMeta.filter(m => m.categoryIds.includes(catFilter)) : linesMeta
    const seen = new Set<string>()
    const result: string[] = []
    for (const m of filtered) {
      if (m.produktovaRada && !seen.has(m.produktovaRada)) {
        seen.add(m.produktovaRada)
        result.push(m.produktovaRada)
      }
    }
    return result.sort()
  })()

  // Client-side sorting within current page
  const sorted = [...products].sort((a, b) => {
    let va: string | number, vb: string | number
    if (sortBy === 'kod') { va = a.kod ?? ''; vb = b.kod ?? '' }
    else if (sortBy === 'nazev') { va = a.nazev; vb = b.nazev }
    else { va = Number(a.standardniCena); vb = Number(b.standardniCena) }
    const cmp = typeof va === 'string' ? va.localeCompare(vb as string, 'cs') : (va as number) - (vb as number)
    return sortDir === 'asc' ? cmp : -cmp
  })

  function getPrice(p: CatalogProduct): number {
    return p.id in cenikPriceMap ? cenikPriceMap[p.id] : Number(p.standardniCena)
  }

  function toggle(p: CatalogProduct) {
    setSelected(s => {
      const next = { ...s }
      if (p.id in next) { delete next[p.id] }
      else { next[p.id] = { qty: 1, price: getPrice(p), nazev: p.nazev, jednotka: p.jednotka } }
      return next
    })
  }

  const pageIds = products.map(p => p.id)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => id in selected)

  function toggleAll() {
    setSelected(s => {
      const next = { ...s }
      if (allPageSelected) { pageIds.forEach(id => delete next[id]) }
      else { products.forEach(p => { if (!(p.id in next)) next[p.id] = { qty: 1, price: getPrice(p), nazev: p.nazev, jednotka: p.jednotka } }) }
      return next
    })
  }

  function handleSort(col: 'kod' | 'nazev' | 'cena') {
    if (sortBy === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortBy(col); setSortDir('asc') }
  }

  const selectedCount = Object.keys(selected).length
  const selectedEntries = Object.entries(selected)

  function handleAdd() {
    const items = selectedEntries.map(([productId, s]) => ({
      productId,
      nazev: s.nazev,
      cenaZaKus: s.price,
      mnozstvi: s.qty,
      jednotka: s.jednotka,
    }))
    onAdd(items)
  }

  function SortIcon({ col }: { col: 'kod' | 'nazev' | 'cena' }) {
    if (sortBy !== col) return <span className="ml-1 opacity-30">↕</span>
    return <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>
  }

  const thCls = 'text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-3 cursor-pointer select-none hover:text-gray-700 dark:hover:text-slate-200'
  const selInp = 'border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-0 md:p-4">
      <div
        className="bg-white dark:bg-slate-800 md:rounded-xl shadow-2xl flex flex-col w-full h-[100dvh] md:h-[80vh] md:max-w-[900px]"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Produkty</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* Filters */}
        <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex gap-2 flex-wrap flex-shrink-0">
          <input
            ref={searchRef}
            placeholder="Hledat v kódu nebo názvu…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="flex-1 min-w-48 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400"
            style={{ fontSize: 16 }}
          />
          <select
            value={catFilter}
            onChange={e => { setCatFilter(e.target.value); setLineFilter('') }}
            className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
          >
            <option value="">Všechny kategorie</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.nazev}</option>)}
          </select>
          {availableLines.length > 0 && (
            <select
              value={lineFilter}
              onChange={e => setLineFilter(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="">Všechny řady</option>
              {availableLines.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          )}
          {cenikList.length > 0 && (
            <select
              value={cenikFilter}
              onChange={e => setCenikFilter(e.target.value)}
              className="border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none"
            >
              <option value="">Standardní ceny</option>
              {cenikList.map(c => <option key={c.id} value={c.id}>{c.nazev}</option>)}
            </select>
          )}
        </div>

        {/* Product table */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <table className="w-full">
            <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700 z-10">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allPageSelected}
                    onChange={toggleAll}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300"
                  />
                </th>
                <th className={`${thCls} hidden md:table-cell`} onClick={() => handleSort('kod')}>KÓD <SortIcon col="kod" /></th>
                <th className={thCls} onClick={() => handleSort('nazev')}>NÁZEV PRODUKTU <SortIcon col="nazev" /></th>
                <th className={`${thCls} text-right`} onClick={() => handleSort('cena')}>CENA <SortIcon col="cena" /></th>
                <th className="hidden md:table-cell text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-3">SAZBA DPH</th>
                <th className="hidden md:table-cell text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-3">PRODUKTOVÁ ŘADA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {loading && Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  <td className="px-4 py-3"><div className="w-4 h-4 bg-gray-200 dark:bg-slate-700 rounded" /></td>
                  <td className="hidden md:table-cell px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-16" /></td>
                  <td className="px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-48" /></td>
                  <td className="px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-20 ml-auto" /></td>
                  <td className="hidden md:table-cell px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-12 ml-auto" /></td>
                  <td className="hidden md:table-cell px-3 py-3"><div className="h-4 bg-gray-200 dark:bg-slate-700 rounded w-24" /></td>
                </tr>
              ))}
              {!loading && sorted.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-14 text-center">
                    <div className="flex justify-center mb-3"><IconBox className="w-10 h-10 text-gray-300 dark:text-slate-600" /></div>
                    <p className="text-sm text-gray-400 dark:text-slate-500">Žádné produkty nenalezeny</p>
                  </td>
                </tr>
              )}
              {!loading && sorted.map(p => {
                const isSelected = p.id in selected
                const hasCenikPrice = p.id in cenikPriceMap
                const price = getPrice(p)
                return (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${isSelected ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                  >
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(p)}
                        className="w-4 h-4 text-blue-600 rounded border-gray-300"
                      />
                    </td>
                    <td className="hidden md:table-cell px-3 py-3 text-sm font-mono text-gray-500 dark:text-slate-400 whitespace-nowrap">{p.kod ?? '—'}</td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-white">
                      {p.nazev}
                      {p.kod && <span className="md:hidden block text-xs font-mono font-normal text-gray-400 dark:text-slate-500 mt-0.5">{p.kod}</span>}
                    </td>
                    <td className="px-3 py-3 text-sm text-right whitespace-nowrap">
                      <span className={hasCenikPrice ? 'text-primary dark:text-primary-light font-medium' : 'text-gray-700 dark:text-slate-300'}>
                        {formatCislo(price)} Kč
                      </span>
                      {hasCenikPrice && <span className="ml-1 text-xs text-blue-400">(ceník)</span>}
                    </td>
                    <td className="hidden md:table-cell px-3 py-3 text-sm text-right text-gray-500 dark:text-slate-400">{p.dphSazba} %</td>
                    <td className="hidden md:table-cell px-3 py-3 text-sm text-gray-500 dark:text-slate-400">{p.produktovaRada ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-2 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between flex-shrink-0 text-xs text-gray-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>Na stránce</span>
            <select
              value={limit}
              onChange={e => { setLimit(Number(e.target.value)); setPage(1) }}
              className="border border-gray-300 dark:border-slate-600 rounded px-2 py-0.5 text-xs bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span>Stránka {page} z {totalPages} ({total} produktů)</span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2 py-0.5 border border-gray-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-700"
            >&lt;</button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2 py-0.5 border border-gray-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-gray-100 dark:hover:bg-slate-700"
            >&gt;</button>
          </div>
        </div>

        {/* Selected products strip */}
        {selectedCount > 0 && (
          <div className="border-t-2 border-blue-200 dark:border-blue-700 flex-shrink-0 max-h-44 overflow-y-auto bg-blue-50 dark:bg-blue-900/10">
            <div className="px-6 py-2 sticky top-0 bg-blue-50 dark:bg-blue-900/20 z-10">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">
                Vybrané produkty [{selectedCount}]
              </p>
            </div>
            <div className="divide-y divide-blue-100 dark:divide-blue-900/30">
              {selectedEntries.map(([productId, s]) => (
                <div key={productId} className="px-4 md:px-6 py-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="flex-1 basis-full md:basis-auto text-sm text-gray-900 dark:text-white truncate min-w-0">{s.nazev}</span>
                  <div className="flex items-center gap-2 flex-shrink-0 ml-auto">
                    <label className="text-xs text-gray-500 dark:text-slate-400">Ks:</label>
                    <input
                      type="number"
                      min="0.001"
                      step="0.001"
                      value={s.qty}
                      onChange={e => setSelected(prev => ({ ...prev, [productId]: { ...prev[productId], qty: Number(e.target.value) } }))}
                      className={`${selInp} w-20 text-right`}
                    />
                    <label className="text-xs text-gray-500 dark:text-slate-400">Cena/ks:</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={s.price}
                      onChange={e => setSelected(prev => ({ ...prev, [productId]: { ...prev[productId], price: Number(e.target.value) } }))}
                      className={`${selInp} w-24 text-right`}
                    />
                    <button
                      onClick={() => setSelected(prev => { const n = { ...prev }; delete n[productId]; return n })}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none"
                    >×</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-4 md:px-6 py-3 md:py-4 pb-safe border-t border-gray-200 dark:border-slate-700 flex items-center justify-between gap-2 flex-shrink-0">
          <p className="text-sm text-gray-500 dark:text-slate-400 hidden sm:block">
            {selectedCount > 0
              ? <span>Vybráno: <strong className="text-gray-900 dark:text-white">{selectedCount}</strong> produktů</span>
              : 'Klikněte na řádek nebo zaškrtněte produkt'}
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Zrušit
            </button>
            <button
              onClick={handleAdd}
              disabled={selectedCount === 0}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
            >
              Vybrat a zavřít ({selectedCount})
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
