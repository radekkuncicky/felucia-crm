'use client'

import { useState, useEffect } from 'react'
import { formatCislo } from '@/lib/format'
import FilterDropdown from '@/components/ui/FilterDropdown'

interface ProductCategory { id: string; nazev: string; barva: string }
interface Product { id: string; kod: string | null; nazev: string; categories: ProductCategory[]; jednotka: string; standardniCena: number }
interface Category { id: string; nazev: string; barva: string }
interface Polozka { id: string; cena: number; product: Product }

function fmt(n: number) { return formatCislo(n) }

interface Props {
  cenikId: string
  cenikNazev: string
  cenikKod: string
  products: Product[]
  categories: Category[]
}

export default function CenikDetail({ cenikId, cenikNazev, cenikKod, products, categories }: Props) {
  const [polozky, setPolozky] = useState<Polozka[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editCena, setEditCena] = useState('')
  const [saving, setSaving] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [addProductId, setAddProductId] = useState('')
  const [addCena, setAddCena] = useState('')
  const [addSearch, setAddSearch] = useState('')
  const [addCatFilter, setAddCatFilter] = useState('')

  useEffect(() => {
    fetch(`/api/ceniky/${cenikId}`)
      .then(r => r.json())
      .then(data => {
        setPolozky(data.polozky ?? [])
        setLoading(false)
      })
  }, [cenikId])

  const filtered = polozky.filter(p => {
    const matchSearch = !search || p.product.nazev.toLowerCase().includes(search.toLowerCase()) || (p.product.kod ?? '').toLowerCase().includes(search.toLowerCase())
    const matchCat = !catFilter || p.product.categories.some(c => c.id === catFilter)
    return matchSearch && matchCat
  })

  // Products not yet in ceník
  const inCenik = new Set(polozky.map(p => p.product.id))
  const availableProducts = products.filter(p => !inCenik.has(p.id) &&
    (!addSearch || p.nazev.toLowerCase().includes(addSearch.toLowerCase()) || (p.kod ?? '').toLowerCase().includes(addSearch.toLowerCase())) &&
    (!addCatFilter || p.categories.some(c => c.id === addCatFilter))
  )

  async function handleSaveEdit(polozkaId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/ceniky/${cenikId}/polozky/${polozkaId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cena: Number(editCena) }),
      })
      if (res.ok) {
        setPolozky(prev => prev.map(p => p.id === polozkaId ? { ...p, cena: Number(editCena) } : p))
        setEditingId(null)
      }
    } finally { setSaving(false) }
  }

  async function handleDelete(polozkaId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/ceniky/${cenikId}/polozky/${polozkaId}`, { method: 'DELETE' })
      if (res.ok) setPolozky(prev => prev.filter(p => p.id !== polozkaId))
    } finally { setSaving(false) }
  }

  async function handleAdd() {
    if (!addProductId || !addCena) return
    setSaving(true)
    try {
      const res = await fetch(`/api/ceniky/${cenikId}/polozky`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId: addProductId, cena: Number(addCena) }),
      })
      if (res.ok) {
        const polozka = await res.json()
        setPolozky(prev => [...prev, polozka])
        setAddProductId(''); setAddCena(''); setAddSearch(''); setShowAdd(false)
      }
    } finally { setSaving(false) }
  }

  const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
  const catFilterOptions = [
    { value: '', label: 'Všechny kategorie' },
    ...categories.map(c => ({ value: c.id, label: c.nazev })),
  ]
  const addCatFilterOptions = [
    { value: '', label: 'Všechny kat.' },
    ...categories.map(c => ({ value: c.id, label: c.nazev })),
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <span className="font-mono text-xs text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">{cenikKod}</span>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-1">{cenikNazev}</h2>
          <p className="text-sm text-gray-500 dark:text-slate-400">{polozky.length} položek v ceníku</p>
        </div>
        <button onClick={() => setShowAdd(s => !s)} className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm">
          + Přidat produkt
        </button>
      </div>

      {/* Add product panel */}
      {showAdd && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl border border-blue-200 dark:border-blue-800 p-4 space-y-3">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Přidat produkt do ceníku</h3>
          <div className="flex gap-2">
            <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Hledat produkt…" className={`${inp} flex-1`} />
            <FilterDropdown value={addCatFilter} onChange={setAddCatFilter} options={addCatFilterOptions} />
          </div>
          <div className="max-h-48 overflow-y-auto border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 divide-y divide-gray-100 dark:divide-slate-700">
            {availableProducts.slice(0, 30).map(p => (
              <button key={p.id} onClick={() => { setAddProductId(p.id); setAddCena(String(p.standardniCena)) }}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors text-left ${addProductId === p.id ? 'bg-blue-50 dark:bg-blue-900/30' : ''}`}>
                <span>
                  {p.kod && <span className="font-mono text-xs text-gray-400 mr-2">{p.kod}</span>}
                  <span className="text-gray-900 dark:text-white">{p.nazev}</span>
                </span>
                <span className="text-gray-500 dark:text-slate-400 text-xs">{fmt(p.standardniCena)} Kč</span>
              </button>
            ))}
            {availableProducts.length === 0 && <p className="px-3 py-2 text-xs text-gray-400 dark:text-slate-500">Žádné dostupné produkty</p>}
          </div>
          {addProductId && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700 dark:text-slate-300">Cena v ceníku (Kč):</label>
              <input type="number" value={addCena} onChange={e => setAddCena(e.target.value)} className={`${inp} w-36`} />
              <button onClick={handleAdd} disabled={saving || !addCena} className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-medium px-3 py-2 rounded-lg text-sm">
                Přidat
              </button>
              <button onClick={() => { setAddProductId(''); setAddCena('') }} className="text-xs text-gray-500">Zrušit výběr</button>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Hledat…" className={`${inp} w-64`} />
        <FilterDropdown value={catFilter} onChange={setCatFilter} options={catFilterOptions} />
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {loading ? (
          <div className="py-10 text-center text-sm text-gray-400">Načítám…</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 dark:bg-slate-700/50 border-b border-gray-200 dark:border-slate-700">
              <tr>
                {['KÓD', 'NÁZEV', 'KATEGORIE', 'JED.', 'CENA V CENÍKU', 'STAND. CENA', 'ROZDÍL %', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.map(p => {
                const diff = p.product.standardniCena > 0 ? Math.round((p.cena / p.product.standardniCena - 1) * 100) : 0
                return (
                  <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-slate-400">{p.product.kod ?? '—'}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{p.product.nazev}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{p.product.categories[0]?.nazev ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{p.product.jednotka}</td>
                    <td className="px-4 py-3">
                      {editingId === p.id ? (
                        <div className="flex items-center gap-2">
                          <input type="number" value={editCena} onChange={e => setEditCena(e.target.value)} className="w-28 border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white" />
                          <button onClick={() => handleSaveEdit(p.id)} disabled={saving} className="text-xs text-green-600 font-medium">OK</button>
                          <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">×</button>
                        </div>
                      ) : (
                        <button onClick={() => { setEditingId(p.id); setEditCena(String(p.cena)) }} className="font-semibold text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-light">
                          {fmt(p.cena)} Kč
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-slate-400">{fmt(p.product.standardniCena)} Kč</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${diff < 0 ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' : diff > 0 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-400'}`}>
                        {diff > 0 ? '+' : ''}{diff} %
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => handleDelete(p.id)} disabled={saving} className="text-xs text-red-400 hover:text-red-600 disabled:opacity-50">Odebrat</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && (
          <div className="py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné položky.</div>
        )}
      </div>
    </div>
  )
}
