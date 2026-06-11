'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

interface QuoteItem {
  id: string
  nazev: string
  mnozstvi: number
  cenaZaKus: number
  poznamky: string
  productId: string
}

interface Product {
  id: string
  nazev: string
  cena: number
  kategorie: string
  jednotka: string
}

interface TemplateItem {
  product_id?: string
  nazev: string
  mnozstvi: number
  cena_za_kus: number
  poznamky?: string
}

interface Template {
  id: string
  nazev: string
  polozky: TemplateItem[]
}

interface Props {
  dealId: string
  items: QuoteItem[]
  products: Product[]
  templates: Template[]
  totalPrice: number
}

export default function QuoteItemsSection({ dealId, items: initItems, products, templates, totalPrice: initTotal }: Props) {
  const router = useRouter()
  const [items, setItems] = useState(initItems)
  const [total, setTotal] = useState(initTotal)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState('')

  const [addForm, setAddForm] = useState({ productId: '', nazev: '', mnozstvi: '1', cenaZaKus: '', poznamky: '' })
  const [editForm, setEditForm] = useState({ nazev: '', mnozstvi: '1', cenaZaKus: '', poznamky: '' })
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null)

  function recalc(newItems: QuoteItem[]) {
    setTotal(newItems.reduce((s, i) => s + i.mnozstvi * i.cenaZaKus, 0))
    setItems(newItems)
  }

  function onProductSelect(productId: string) {
    const p = products.find((p) => p.id === productId)
    setAddForm((f) => ({ ...f, productId, nazev: p?.nazev ?? '', cenaZaKus: p ? String(p.cena) : '' }))
  }

  async function handleAdd() {
    if (!addForm.nazev || !addForm.mnozstvi || !addForm.cenaZaKus) return
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, mnozstvi: Number(addForm.mnozstvi), cenaZaKus: Number(addForm.cenaZaKus) }),
      })
      if (res.ok) {
        const item = await res.json()
        const newItem = { id: item.id, nazev: item.nazev, mnozstvi: Number(item.mnozstvi), cenaZaKus: Number(item.cenaZaKus), poznamky: item.poznamky ?? '', productId: item.productId ?? '' }
        recalc([...items, newItem])
        setAdding(false)
        setAddForm({ productId: '', nazev: '', mnozstvi: '1', cenaZaKus: '', poznamky: '' })
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteItemId) return
    await fetch(`/api/deals/${dealId}/items/${deleteItemId}`, { method: 'DELETE' })
    recalc(items.filter((i) => i.id !== deleteItemId))
    setDeleteItemId(null)
  }

  function startEdit(item: QuoteItem) {
    setEditingId(item.id)
    setEditForm({ nazev: item.nazev, mnozstvi: String(item.mnozstvi), cenaZaKus: String(item.cenaZaKus), poznamky: item.poznamky })
  }

  async function handleSaveEdit(itemId: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}/items/${itemId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...editForm, mnozstvi: Number(editForm.mnozstvi), cenaZaKus: Number(editForm.cenaZaKus) }),
      })
      if (res.ok) {
        recalc(items.map((i) => i.id === itemId ? { ...i, nazev: editForm.nazev, mnozstvi: Number(editForm.mnozstvi), cenaZaKus: Number(editForm.cenaZaKus), poznamky: editForm.poznamky } : i))
        setEditingId(null)
      }
    } finally {
      setSaving(false)
    }
  }

  async function applyTemplate() {
    const tpl = templates.find((t) => t.id === selectedTemplate)
    if (!tpl) return
    setSaving(true)
    try {
      for (const p of tpl.polozky) {
        const product = p.product_id ? products.find((pr) => pr.id === p.product_id) : null
        const res = await fetch(`/api/deals/${dealId}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: p.product_id || null,
            nazev: p.nazev || product?.nazev || 'Položka',
            mnozstvi: Number(p.mnozstvi) || 1,
            cenaZaKus: Number(p.cena_za_kus) || (product ? product.cena : 0),
            poznamky: p.poznamky || null,
          }),
        })
        if (res.ok) {
          const item = await res.json()
          setItems((prev) => [...prev, { id: item.id, nazev: item.nazev, mnozstvi: Number(item.mnozstvi), cenaZaKus: Number(item.cenaZaKus), poznamky: item.poznamky ?? '', productId: item.productId ?? '' }])
        }
      }
      setSelectedTemplate('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const inp = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <>
    <ConfirmModal
      isOpen={deleteItemId !== null}
      title="Smazat položku"
      message="Smazat tuto položku?"
      confirmLabel="Smazat"
      danger
      onConfirm={handleDeleteConfirm}
      onCancel={() => setDeleteItemId(null)}
    />
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Nabídka — položky</h2>
        <div className="flex items-center gap-3">
          {templates.length > 0 && (
            <div className="flex items-center gap-2">
              <select
                value={selectedTemplate}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none"
              >
                <option value="">Použít šablonu…</option>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nazev}</option>)}
              </select>
              {selectedTemplate && (
                <button onClick={applyTemplate} disabled={saving} className="bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium px-3 py-1.5 rounded-lg">
                  Vložit
                </button>
              )}
            </div>
          )}
          <button
            onClick={() => setAdding(true)}
            className="bg-primary hover:bg-primary-hover text-white text-sm font-medium px-3 py-1.5 rounded-lg"
          >
            + Přidat položku
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
      <table className="w-full" style={{ minWidth: 600 }}>
        <thead className="bg-gray-50">
          <tr>
            <th className="text-left text-xs font-semibold text-gray-500 uppercase px-6 py-3">Název</th>
            <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Množství</th>
            <th className="text-right text-xs font-semibold text-gray-500 uppercase px-4 py-3">Cena/ks</th>
            <th className="text-right text-xs font-semibold text-gray-500 uppercase px-6 py-3">Celkem</th>
            <th className="px-4 py-3" />
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {items.length === 0 && !adding && (
            <tr>
              <td colSpan={5} className="px-6 py-6 text-center text-sm text-gray-400">Žádné položky. Přidejte položku nebo použijte šablonu.</td>
            </tr>
          )}

          {items.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              {editingId === item.id ? (
                <>
                  <td className="px-4 py-3">
                    <input value={editForm.nazev} onChange={(e) => setEditForm(f => ({ ...f, nazev: e.target.value }))} className={`${inp} w-full`} />
                    <input placeholder="Poznámka" value={editForm.poznamky} onChange={(e) => setEditForm(f => ({ ...f, poznamky: e.target.value }))} className={`${inp} w-full mt-1`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" step="0.001" value={editForm.mnozstvi} onChange={(e) => setEditForm(f => ({ ...f, mnozstvi: e.target.value }))} className={`${inp} w-20 text-right`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" step="0.01" value={editForm.cenaZaKus} onChange={(e) => setEditForm(f => ({ ...f, cenaZaKus: e.target.value }))} className={`${inp} w-24 text-right`} />
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold">
                    {(Number(editForm.mnozstvi) * Number(editForm.cenaZaKus)).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleSaveEdit(item.id)} disabled={saving} className="text-xs text-green-600 hover:text-green-800 mr-2">Uložit</button>
                    <button onClick={() => setEditingId(null)} className="text-xs text-gray-500 hover:text-gray-700">Zrušit</button>
                  </td>
                </>
              ) : (
                <>
                  <td className="px-6 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.nazev}</p>
                    {item.poznamky && <p className="text-xs text-gray-500">{item.poznamky}</p>}
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{item.mnozstvi}</td>
                  <td className="px-4 py-3 text-right text-sm text-gray-600">{item.cenaZaKus.toLocaleString('cs-CZ')} Kč</td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    {(item.mnozstvi * item.cenaZaKus).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => startEdit(item)} className="text-xs text-blue-600 hover:text-blue-800 mr-2">Upravit</button>
                    <button onClick={() => setDeleteItemId(item.id)} className="text-xs text-red-500 hover:text-red-700">Smazat</button>
                  </td>
                </>
              )}
            </tr>
          ))}

          {adding && (
            <tr className="bg-blue-50">
              <td className="px-4 py-3">
                <select onChange={(e) => onProductSelect(e.target.value)} className={`${inp} w-full mb-1`}>
                  <option value="">— Vyberte z katalogu nebo zadejte ručně —</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.kategorie ? `${p.kategorie} / ` : ''}{p.nazev}</option>)}
                </select>
                <input placeholder="Název položky *" value={addForm.nazev} onChange={(e) => setAddForm(f => ({ ...f, nazev: e.target.value }))} className={`${inp} w-full mb-1`} />
                <input placeholder="Poznámka" value={addForm.poznamky} onChange={(e) => setAddForm(f => ({ ...f, poznamky: e.target.value }))} className={`${inp} w-full`} />
              </td>
              <td className="px-4 py-3 text-right">
                <input type="number" min="0" step="0.001" placeholder="Množ." value={addForm.mnozstvi} onChange={(e) => setAddForm(f => ({ ...f, mnozstvi: e.target.value }))} className={`${inp} w-20 text-right`} />
              </td>
              <td className="px-4 py-3 text-right">
                <input type="number" min="0" step="0.01" placeholder="Cena" value={addForm.cenaZaKus} onChange={(e) => setAddForm(f => ({ ...f, cenaZaKus: e.target.value }))} className={`${inp} w-24 text-right`} />
              </td>
              <td className="px-6 py-3 text-right text-sm font-semibold text-gray-500">
                {(Number(addForm.mnozstvi) * Number(addForm.cenaZaKus)).toLocaleString('cs-CZ')} Kč
              </td>
              <td className="px-4 py-3 text-right">
                <button onClick={handleAdd} disabled={saving || !addForm.nazev} className="text-xs text-green-600 hover:text-green-800 mr-2 disabled:opacity-50">Přidat</button>
                <button onClick={() => { setAdding(false); setAddForm({ productId: '', nazev: '', mnozstvi: '1', cenaZaKus: '', poznamky: '' }) }} className="text-xs text-gray-500 hover:text-gray-700">Zrušit</button>
              </td>
            </tr>
          )}
        </tbody>
        <tfoot className="border-t-2 border-gray-200 bg-gray-50">
          <tr>
            <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">Celková cena nabídky:</td>
            <td className="px-6 py-3 text-right text-lg font-bold text-gray-900">{total.toLocaleString('cs-CZ')} Kč</td>
            <td />
          </tr>
        </tfoot>
      </table>
      </div>
    </div>
    </>
  )
}
