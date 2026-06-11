'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

interface Product {
  id: string
  nazev: string
  kod: string | null
  aktivni: boolean
}

interface ProductWithCat extends Product {
  categoryIds: string[]
}

interface Category {
  id: string
  nazev: string
  barva: string
  poradi: number
  products: Product[]
}

const COLOR_OPTIONS = [
  '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444',
  '#F97316', '#06B6D4', '#EC4899', '#6B7280', '#84CC16',
]

// ── Add/Edit category form ────────────────────────────────────────────────────

function CategoryForm({
  initial,
  onSave,
  onCancel,
  saving,
}: {
  initial: { nazev: string; barva: string }
  onSave: (nazev: string, barva: string) => void
  onCancel: () => void
  saving: boolean
}) {
  const [nazev, setNazev] = useState(initial.nazev)
  const [barva, setBarva] = useState(initial.barva)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={barva}
            onChange={e => setBarva(e.target.value)}
            className="w-9 h-9 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
          />
        </div>
        <input
          autoFocus
          placeholder="Název kategorie *"
          value={nazev}
          onChange={e => setNazev(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && nazev && onSave(nazev, barva)}
          className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
        />
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {COLOR_OPTIONS.map(c => (
          <button
            key={c}
            type="button"
            onClick={() => setBarva(c)}
            className={`w-6 h-6 rounded-full border-2 transition-transform ${barva === c ? 'border-gray-900 dark:border-white scale-110' : 'border-transparent'}`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => nazev && onSave(nazev, barva)}
          disabled={saving || !nazev}
          className="px-4 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover disabled:opacity-50 rounded-lg"
        >
          {saving ? 'Ukládám…' : 'Uložit'}
        </button>
        <button onClick={onCancel} className="px-4 py-1.5 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900">
          Zrušit
        </button>
      </div>
    </div>
  )
}

// ── Product picker modal ──────────────────────────────────────────────────────

function ProductPickerModal({
  categoryName,
  availableProducts,
  onClose,
  onAdd,
}: {
  categoryName: string
  availableProducts: Product[]
  onClose: () => void
  onAdd: (ids: string[]) => void
}) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return availableProducts.filter(p =>
      p.nazev.toLowerCase().includes(q) || (p.kod ?? '').toLowerCase().includes(q)
    )
  }, [search, availableProducts])

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (filtered.every(p => selected.has(p.id))) {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(p => next.delete(p.id))
        return next
      })
    } else {
      setSelected(prev => {
        const next = new Set(prev)
        filtered.forEach(p => next.add(p.id))
        return next
      })
    }
  }

  async function handleConfirm() {
    if (selected.size === 0) return
    setSaving(true)
    onAdd(Array.from(selected))
  }

  const allFiltered = filtered.length > 0 && filtered.every(p => selected.has(p.id))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl flex flex-col" style={{ width: 'min(560px, 100%)', maxHeight: '80vh' }}>
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Přidat produkty do kategorie</h3>
            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{categoryName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <input
            autoFocus
            placeholder="Hledat produkt…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary placeholder-gray-400"
          />
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {filtered.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
              {availableProducts.length === 0 ? 'Všechny produkty jsou již přiřazeny do této kategorie.' : 'Žádné produkty neodpovídají hledání.'}
            </div>
          ) : (
            <table className="w-full">
              <thead className="sticky top-0 bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                <tr>
                  <th className="px-4 py-2.5 w-10">
                    <input type="checkbox" checked={allFiltered} onChange={toggleAll} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-2.5">Název</th>
                  <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-3 py-2.5">Kód</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => toggle(p.id)}
                    className={`cursor-pointer transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/20 ${selected.has(p.id) ? 'bg-yellow-50 dark:bg-yellow-900/20' : ''}`}
                  >
                    <td className="px-4 py-2.5" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} className="w-4 h-4 text-blue-600 rounded border-gray-300" />
                    </td>
                    <td className="px-3 py-2.5 text-sm text-gray-900 dark:text-white">
                      {p.nazev}
                      {!p.aktivni && <span className="ml-1.5 text-xs text-gray-400">(neaktivní)</span>}
                    </td>
                    <td className="px-3 py-2.5 text-sm font-mono text-gray-500 dark:text-slate-400">{p.kod ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex items-center justify-between flex-shrink-0">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {selected.size > 0 ? <><strong className="text-gray-900 dark:text-white">{selected.size}</strong> vybraných</> : 'Klikněte na řádek pro výběr'}
          </span>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
              Zrušit
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0 || saving}
              className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
            >
              {saving ? 'Přiřazuji…' : `Přidat (${selected.size})`}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main client component ─────────────────────────────────────────────────────

export default function CategoriesClient({
  initCategories,
  allProducts,
}: {
  initCategories: Category[]
  allProducts: ProductWithCat[]
}) {
  const router = useRouter()
  const [categories, setCategories] = useState<Category[]>(initCategories)
  const [productMap, setProductMap] = useState<Record<string, ProductWithCat>>(
    Object.fromEntries(allProducts.map(p => [p.id, p]))
  )

  const [addingNew, setAddingNew] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [pickerForCatId, setPickerForCatId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)

  function toggleExpand(id: string) {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Products available to add to a given category (not yet in it)
  function availableForCategory(catId: string): Product[] {
    return Object.values(productMap).filter(p => !p.categoryIds.includes(catId))
  }

  // ── Category CRUD ───────────────────────────────────────────────────────────

  async function handleCreate(nazev: string, barva: string) {
    setSavingId('new')
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, barva }),
      })
      if (!res.ok) return
      const cat = await res.json()
      setCategories(prev => [...prev, { ...cat, products: [] }])
      setAddingNew(false)
      router.refresh()
    } finally { setSavingId(null) }
  }

  async function handleEdit(id: string, nazev: string, barva: string) {
    setSavingId(id)
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, barva }),
      })
      if (!res.ok) return
      setCategories(prev => prev.map(c => c.id === id ? { ...c, nazev, barva } : c))
      setEditingId(null)
      router.refresh()
    } finally { setSavingId(null) }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    const cat = categories.find(c => c.id === deleteId)
    await fetch(`/api/categories/${deleteId}`, { method: 'DELETE' })
    // Unlink products from state
    const catProductIds = new Set(cat?.products.map(p => p.id) ?? [])
    setProductMap(prev => {
      const next = { ...prev }
      catProductIds.forEach(pid => { if (next[pid]) next[pid] = { ...next[pid], categoryIds: next[pid].categoryIds.filter(cid => cid !== deleteId) } })
      return next
    })
    setCategories(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    router.refresh()
  }

  // ── Product assignment ──────────────────────────────────────────────────────

  async function handleAddProducts(catId: string, productIds: string[]) {
    setPickerForCatId(null)
    await fetch(`/api/categories/${catId}/products`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productIds }),
    })
    const addedProducts = productIds.map(pid => productMap[pid]).filter(Boolean)
    setCategories(prev => prev.map(c => {
      if (c.id !== catId) return c
      const existing = new Set(c.products.map(p => p.id))
      const newProds = addedProducts.filter(p => !existing.has(p.id))
      return { ...c, products: [...c.products, ...newProds].sort((a, b) => a.nazev.localeCompare(b.nazev, 'cs')) }
    }))
    setProductMap(prev => {
      const next = { ...prev }
      productIds.forEach(pid => {
        if (next[pid] && !next[pid].categoryIds.includes(catId)) {
          next[pid] = { ...next[pid], categoryIds: [...next[pid].categoryIds, catId] }
        }
      })
      return next
    })
    router.refresh()
  }

  async function handleRemoveProduct(catId: string, productId: string) {
    await fetch(`/api/categories/${catId}/products/${productId}`, { method: 'DELETE' })
    setCategories(prev => prev.map(c =>
      c.id === catId ? { ...c, products: c.products.filter(p => p.id !== productId) } : c
    ))
    setProductMap(prev => ({
      ...prev,
      [productId]: { ...prev[productId], categoryIds: prev[productId].categoryIds.filter(id => id !== catId) },
    }))
    router.refresh()
  }

  const pickerCategory = pickerForCatId ? categories.find(c => c.id === pickerForCatId) : null

  const deleteCategory = categories.find(c => c.id === deleteId)

  return (
    <>
      <ConfirmModal
        isOpen={deleteId !== null}
        title="Smazat kategorii"
        message={deleteCategory ? `Smazat kategorii „${deleteCategory.nazev}"? Produkty budou zachovány, ale zůstanou bez kategorie.` : 'Smazat kategorii?'}
        confirmLabel="Smazat"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
      <div className="space-y-4">
        {/* Category cards */}
        {categories.map(cat => {
          const isExpanded = expandedIds.has(cat.id)
          const isEditing = editingId === cat.id
          return (
            <div key={cat.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleExpand(cat.id)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 flex-shrink-0"
                >
                  <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>

                <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.barva }} />

                {isEditing ? (
                  <div className="flex-1">
                    <CategoryForm
                      initial={{ nazev: cat.nazev, barva: cat.barva }}
                      onSave={(n, b) => handleEdit(cat.id, n, b)}
                      onCancel={() => setEditingId(null)}
                      saving={savingId === cat.id}
                    />
                  </div>
                ) : (
                  <>
                    <button onClick={() => toggleExpand(cat.id)} className="flex-1 text-left">
                      <span className="font-semibold text-gray-900 dark:text-white">{cat.nazev}</span>
                      <span className="ml-2 text-sm text-gray-400 dark:text-slate-500">{cat.products.length} produktů</span>
                    </button>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(cat.id); setAddingNew(false) }}
                        className="text-xs text-gray-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        Upravit
                      </button>
                      <button
                        onClick={() => setDeleteId(cat.id)}
                        className="text-xs text-gray-500 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-700"
                      >
                        Smazat
                      </button>
                    </div>
                  </>
                )}
              </div>

              {/* Products list */}
              {isExpanded && (
                <div className="border-t border-gray-100 dark:border-slate-700">
                  {cat.products.length === 0 ? (
                    <p className="px-6 py-4 text-sm text-gray-400 dark:text-slate-500">Žádné produkty v kategorii.</p>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-slate-900/50">
                        <tr>
                          <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-2.5">Název produktu</th>
                          <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-2.5">Kód</th>
                          <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-2.5">Stav</th>
                          <th className="px-4 py-2.5 w-16" />
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-slate-700/50">
                        {cat.products.map(p => (
                          <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                            <td className="px-6 py-3 text-sm text-gray-900 dark:text-white font-medium">{p.nazev}</td>
                            <td className="px-4 py-3 text-sm font-mono text-gray-500 dark:text-slate-400">{p.kod ?? '—'}</td>
                            <td className="px-4 py-3">
                              <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium ${p.aktivni ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                                {p.aktivni ? 'Aktivní' : 'Neaktivní'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                onClick={() => handleRemoveProduct(cat.id, p.id)}
                                className="text-xs text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                title="Odebrat z kategorie"
                              >
                                Odebrat
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  <div className="px-6 py-3 border-t border-gray-100 dark:border-slate-700">
                    <button
                      onClick={() => { setPickerForCatId(cat.id); setExpandedIds(prev => { const n = new Set(Array.from(prev)); n.add(cat.id); return n }) }}
                      className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                      Přidat produkty
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {/* Empty state */}
        {categories.length === 0 && !addingNew && (
          <div className="text-center py-16 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
            <div className="text-4xl mb-3">🏷️</div>
            <p className="text-gray-500 dark:text-slate-400 text-sm">Žádné kategorie. Vytvořte první kategorii.</p>
          </div>
        )}

        {/* New category form */}
        {addingNew ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-blue-300 dark:border-blue-600 p-6">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-4">Nová kategorie</h3>
            <CategoryForm
              initial={{ nazev: '', barva: '#3B82F6' }}
              onSave={handleCreate}
              onCancel={() => setAddingNew(false)}
              saving={savingId === 'new'}
            />
          </div>
        ) : (
          <button
            onClick={() => { setAddingNew(true); setEditingId(null) }}
            className="w-full border-2 border-dashed border-gray-300 dark:border-slate-600 hover:border-primary-light dark:hover:border-blue-500 text-gray-500 dark:text-slate-400 hover:text-primary dark:hover:text-primary-light text-sm py-3 rounded-xl transition-colors font-medium"
          >
            + Nová kategorie
          </button>
        )}
      </div>

      {/* Product picker modal */}
      {pickerForCatId && pickerCategory && (
        <ProductPickerModal
          categoryName={pickerCategory.nazev}
          availableProducts={availableForCategory(pickerForCatId)}
          onClose={() => setPickerForCatId(null)}
          onAdd={ids => handleAddProducts(pickerForCatId, ids)}
        />
      )}
    </>
  )
}
