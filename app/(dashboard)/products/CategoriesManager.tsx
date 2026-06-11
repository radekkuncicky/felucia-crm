'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import ConfirmModal from '@/components/ConfirmModal'

interface Category {
  id: string
  nazev: string
  barva: string
  poradi: number
}

const colorOptions = [
  '#3B82F6', '#F59E0B', '#10B981', '#8B5CF6', '#EF4444',
  '#F97316', '#06B6D4', '#EC4899', '#6B7280', '#84CC16',
]

export default function CategoriesManager({ categories: initCats }: { categories: Category[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [cats, setCats] = useState(initCats)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [addForm, setAddForm] = useState({ nazev: '', barva: '#3B82F6' })
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ nazev: '', barva: '' })

  async function handleAdd() {
    if (!addForm.nazev) return
    setSaving(true)
    try {
      const res = await fetch('/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(addForm),
      })
      if (res.ok) {
        const cat = await res.json()
        setCats(prev => [...prev, cat])
        setAdding(false)
        setAddForm({ nazev: '', barva: '#3B82F6' })
        router.refresh()
      }
    } finally { setSaving(false) }
  }

  async function handleEdit(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editForm),
      })
      if (res.ok) {
        setCats(prev => prev.map(c => c.id === id ? { ...c, ...editForm } : c))
        setEditingId(null)
        router.refresh()
      }
    } finally { setSaving(false) }
  }

  async function handleDeleteConfirm() {
    if (!deleteId) return
    await fetch(`/api/categories/${deleteId}`, { method: 'DELETE' })
    setCats(prev => prev.filter(c => c.id !== deleteId))
    setDeleteId(null)
    router.refresh()
  }

  return (
    <>
      <ConfirmModal
        isOpen={deleteId !== null}
        title="Smazat kategorii"
        message="Smazat kategorii? Produkty nebudou smazány."
        confirmLabel="Smazat"
        danger
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteId(null)}
      />
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 border border-gray-300 hover:border-gray-400 text-gray-700 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
        </svg>
        Kategorie
      </button>

      {open && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="font-bold text-lg text-gray-900">Správa kategorií</h2>
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 space-y-3">
              {cats.map(cat => (
                <div key={cat.id} className="flex items-center gap-3 p-3 border border-gray-200 rounded-lg">
                  {editingId === cat.id ? (
                    <>
                      <input
                        type="color"
                        value={editForm.barva}
                        onChange={e => setEditForm(f => ({ ...f, barva: e.target.value }))}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                      />
                      <input
                        value={editForm.nazev}
                        onChange={e => setEditForm(f => ({ ...f, nazev: e.target.value }))}
                        className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm"
                        autoFocus
                      />
                      <button onClick={() => handleEdit(cat.id)} disabled={saving} className="text-xs text-green-600 hover:text-green-800">Uložit</button>
                      <button onClick={() => setEditingId(null)} className="text-xs text-gray-500">Zrušit</button>
                    </>
                  ) : (
                    <>
                      <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: cat.barva }} />
                      <span className="flex-1 text-sm font-medium text-gray-900">{cat.nazev}</span>
                      <button onClick={() => { setEditingId(cat.id); setEditForm({ nazev: cat.nazev, barva: cat.barva }) }} className="text-xs text-blue-600 hover:text-blue-800">Upravit</button>
                      <button onClick={() => setDeleteId(cat.id)} className="text-xs text-red-400 hover:text-red-600">Smazat</button>
                    </>
                  )}
                </div>
              ))}

              {cats.length === 0 && !adding && (
                <p className="text-sm text-gray-400 text-center py-4">Žádné kategorie.</p>
              )}

              {adding ? (
                <div className="border border-blue-200 bg-blue-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <input type="color" value={addForm.barva} onChange={e => setAddForm(f => ({ ...f, barva: e.target.value }))} className="w-8 h-8 rounded cursor-pointer border-0 p-0" />
                    <input autoFocus placeholder="Název kategorie *" value={addForm.nazev} onChange={e => setAddForm(f => ({ ...f, nazev: e.target.value }))} className="flex-1 border border-gray-300 rounded px-3 py-1.5 text-sm" onKeyDown={e => e.key === 'Enter' && handleAdd()} />
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {colorOptions.map(c => (
                      <button key={c} onClick={() => setAddForm(f => ({ ...f, barva: c }))} className={`w-6 h-6 rounded-full border-2 ${addForm.barva === c ? 'border-gray-900' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={handleAdd} disabled={saving || !addForm.nazev} className="text-sm bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg">
                      {saving ? 'Ukládám…' : 'Přidat'}
                    </button>
                    <button onClick={() => { setAdding(false); setAddForm({ nazev: '', barva: '#3B82F6' }) }} className="text-sm text-gray-600 px-3 py-1.5">Zrušit</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAdding(true)} className="w-full border border-dashed border-gray-300 hover:border-primary-light text-gray-500 hover:text-blue-600 text-sm py-2 rounded-lg transition-colors">
                  + Přidat kategorii
                </button>
              )}
            </div>

            <div className="p-4 border-t border-gray-100">
              <button onClick={() => setOpen(false)} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 rounded-lg text-sm">
                Zavřít
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
