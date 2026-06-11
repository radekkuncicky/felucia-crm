'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function NewProductForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    kod: '',
    nazev: '',
    produktovaRada: '',
    popis: '',
    dphSazba: '12',
    standardniCena: '',
    nakladovaCena: '',
    jednotka: 'ks',
  })

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-800 text-gray-900 dark:text-white'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          kod: form.kod || null,
          produktovaRada: form.produktovaRada || null,
          popis: form.popis || null,
          dphSazba: Number(form.dphSazba),
          standardniCena: Number(form.standardniCena),
          nakladovaCena: form.nakladovaCena !== '' ? Number(form.nakladovaCena) : null,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      router.push('/products')
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
      {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Kód</label>
          <input type="text" value={form.kod} onChange={e => setForm(f => ({ ...f, kod: e.target.value }))} className={inp} placeholder="Volitelné" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jednotka</label>
          <select value={form.jednotka} onChange={e => setForm(f => ({ ...f, jednotka: e.target.value }))} className={inp}>
            <option value="ks">ks</option>
            <option value="hod">hod</option>
            <option value="m">m</option>
            <option value="m2">m²</option>
            <option value="m3">m³</option>
            <option value="paušál">paušál</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název *</label>
        <input type="text" required value={form.nazev} onChange={e => setForm(f => ({ ...f, nazev: e.target.value }))} className={inp} />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Produktová řada</label>
        <input type="text" value={form.produktovaRada} onChange={e => setForm(f => ({ ...f, produktovaRada: e.target.value }))} className={inp} placeholder="Volitelné" />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Popis</label>
        <textarea rows={3} value={form.popis} onChange={e => setForm(f => ({ ...f, popis: e.target.value }))} className={inp} placeholder="Volitelné" />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Standardní cena (Kč) *</label>
          <input type="number" required min="0" step="0.01" value={form.standardniCena} onChange={e => setForm(f => ({ ...f, standardniCena: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Nákladová cena (Kč)</label>
          <input type="number" min="0" step="0.01" value={form.nakladovaCena} onChange={e => setForm(f => ({ ...f, nakladovaCena: e.target.value }))} className={inp} placeholder="Volitelné" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">DPH sazba (%)</label>
          <select value={form.dphSazba} onChange={e => setForm(f => ({ ...f, dphSazba: e.target.value }))} className={inp}>
            <option value="12">12 %</option>
            <option value="21">21 %</option>
            <option value="0">0 %</option>
          </select>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
          {saving ? 'Ukládám…' : 'Vytvořit produkt'}
        </button>
        <Link href="/products" className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">Zrušit</Link>
      </div>
    </form>
  )
}
