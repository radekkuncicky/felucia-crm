'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

interface CenikPolozka {
  id: string
  cenikId: string
  cena: number
  cenik: { id: string; kod: string; nazev: string }
}

interface Category { id: string; nazev: string; barva: string }

interface ProductDetailProps {
  product: {
    id: string
    kod: string | null
    nazev: string
    produktovaRada: string | null
    jednotka: string
    popis: string | null
    dphSazba: number
    nakladovaCena: number | null
    standardniCena: number
    objednaciKod: string | null
    dodavatel: string | null
    dodaciLhuta: string | null
    aktivni: boolean
    vytvoreno: string
    cenikPolozky: CenikPolozka[]
    categories: Category[]
  }
  allCategories: Category[]
  usage: { totalCount: number; lastUsed: string | null }
}

function fmt(n: number) {
  return n.toLocaleString('cs-CZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function MarzeChip({ nakladova, standardni }: { nakladova: number | null; standardni: number }) {
  if (!nakladova || nakladova <= 0 || standardni <= 0) return <span className="text-gray-400 dark:text-slate-500">—</span>
  const marze = ((standardni - nakladova) / standardni) * 100
  const color =
    marze >= 30 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
    : marze >= 10 ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400'
    : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-semibold ${color}`}>
      {marze >= 0 ? '+' : ''}{marze.toFixed(1)} %
    </span>
  )
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-900 text-gray-900 dark:text-white'
const label = 'block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5'

export default function ProductDetail({ product, allCategories, usage }: ProductDetailProps) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const [form, setForm] = useState({
    kod: product.kod ?? '',
    nazev: product.nazev,
    produktovaRada: product.produktovaRada ?? '',
    jednotka: product.jednotka,
    popis: product.popis ?? '',
    dphSazba: String(product.dphSazba),
    nakladovaCena: product.nakladovaCena !== null ? String(product.nakladovaCena) : '',
    standardniCena: String(product.standardniCena),
    objednaciKod: product.objednaciKod ?? '',
    dodavatel: product.dodavatel ?? '',
    dodaciLhuta: product.dodaciLhuta ?? '',
    aktivni: product.aktivni,
  })
  // Category M2M state — set of currently assigned category IDs
  const [assignedCatIds, setAssignedCatIds] = useState<Set<string>>(
    new Set(product.categories.map(c => c.id))
  )
  const [savingCatId, setSavingCatId] = useState<string | null>(null)

  // Ceník inline editing state
  const [cenikPolozky, setCenikPolozky] = useState<CenikPolozka[]>(product.cenikPolozky)
  const [editingCenikId, setEditingCenikId] = useState<string | null>(null)
  const [editingCena, setEditingCena] = useState('')
  const [savingCenik, setSavingCenik] = useState(false)

  const stdCena = parseFloat(form.standardniCena) || 0
  const nakCena = form.nakladovaCena !== '' ? parseFloat(form.nakladovaCena) : null

  function set(field: keyof typeof form, value: string | boolean) {
    setForm(f => ({ ...f, [field]: value }))
    setSuccess(false)
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setSuccess(false)
    try {
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kod: form.kod || null,
          nazev: form.nazev,
          produktovaRada: form.produktovaRada || null,
          jednotka: form.jednotka,
          popis: form.popis || null,
          dphSazba: Number(form.dphSazba),
          nakladovaCena: form.nakladovaCena !== '' ? Number(form.nakladovaCena) : null,
          standardniCena: Number(form.standardniCena),
          objednaciKod: form.objednaciKod || null,
          dodavatel: form.dodavatel || null,
          dodaciLhuta: form.dodaciLhuta || null,
          aktivni: form.aktivni,
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      setSuccess(true)
      router.refresh()
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  async function toggleCategory(catId: string) {
    const isAssigned = assignedCatIds.has(catId)
    setSavingCatId(catId)
    try {
      const newIds = new Set(assignedCatIds)
      if (isAssigned) newIds.delete(catId); else newIds.add(catId)
      setAssignedCatIds(newIds)
      await fetch(`/api/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryIds: Array.from(newIds) }),
      })
    } finally {
      setSavingCatId(null)
    }
  }

  async function toggleAktivni() {
    const newVal = !form.aktivni
    set('aktivni', newVal)
    await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ aktivni: newVal }),
    })
    router.refresh()
  }

  async function saveCenikPrice(polozka: CenikPolozka) {
    const cena = parseFloat(editingCena)
    if (isNaN(cena) || cena < 0) { setEditingCenikId(null); return }
    setSavingCenik(true)
    try {
      const res = await fetch(`/api/ceniky/${polozka.cenikId}/polozky/${polozka.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cena }),
      })
      if (res.ok) {
        setCenikPolozky(prev => prev.map(p => p.id === polozka.id ? { ...p, cena } : p))
      }
    } finally {
      setSavingCenik(false)
      setEditingCenikId(null)
    }
  }

  const sectionCard = 'bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6'
  const sectionTitle = 'text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wide mb-4 pb-3 border-b border-gray-100 dark:border-slate-700'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href="/products" className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300 text-sm">← Produkty</Link>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{product.nazev}</h1>
              {product.kod && (
                <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded">{product.kod}</span>
              )}
              <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${form.aktivni ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400'}`}>
                {form.aktivni ? 'Aktivní' : 'Neaktivní'}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
              Přidáno {formatDate(product.vytvoreno)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={toggleAktivni}
            className={`text-sm px-3 py-2 rounded-lg border transition-colors ${
              form.aktivni
                ? 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-900/20'
                : 'border-green-300 text-green-600 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-900/20'
            }`}
          >
            {form.aktivni ? 'Deaktivovat' : 'Aktivovat'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm"
          >
            {saving ? 'Ukládám…' : 'Uložit změny'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg border border-red-200 dark:border-red-800">{error}</div>}
      {success && <div className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm px-4 py-3 rounded-lg border border-green-200 dark:border-green-800">Změny uloženy.</div>}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column - main info */}
        <div className="lg:col-span-2 space-y-6">

          {/* Základní informace */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Základní informace</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Kód produktu</label>
                  <input type="text" value={form.kod} onChange={e => set('kod', e.target.value)} className={inp} placeholder="Volitelné" />
                </div>
                <div>
                  <label className={label}>Jednotka</label>
                  <select value={form.jednotka} onChange={e => set('jednotka', e.target.value)} className={inp}>
                    <option value="ks">ks</option>
                    <option value="hod">hod</option>
                    <option value="m">m</option>
                    <option value="m2">m²</option>
                    <option value="m3">m³</option>
                    <option value="paušál">paušál</option>
                    <option value="sada">sada</option>
                  </select>
                </div>
              </div>

              <div>
                <label className={label}>Název *</label>
                <input type="text" required value={form.nazev} onChange={e => set('nazev', e.target.value)} className={inp} />
              </div>

              <div>
                <label className={label}>Produktová řada</label>
                <input type="text" value={form.produktovaRada} onChange={e => set('produktovaRada', e.target.value)} className={inp} placeholder="Volitelné" />
              </div>

              {/* Categories - M2M checkbox table */}
              <div>
                <label className={label}>Kategorie</label>
                {allCategories.length === 0 ? (
                  <p className="text-sm text-gray-400 dark:text-slate-500">Žádné kategorie. Vytvořte je v <a href="/settings/categories" className="text-blue-600 underline">Nastavení → Kategorie</a>.</p>
                ) : (
                  <div className="border border-gray-200 dark:border-slate-600 rounded-lg overflow-hidden">
                    {allCategories.map((cat, i) => {
                      const checked = assignedCatIds.has(cat.id)
                      const isSaving = savingCatId === cat.id
                      return (
                        <label
                          key={cat.id}
                          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-gray-50 dark:hover:bg-slate-700/50 ${i > 0 ? 'border-t border-gray-100 dark:border-slate-700' : ''} ${checked ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={isSaving}
                            onChange={() => toggleCategory(cat.id)}
                            className="w-4 h-4 text-blue-600 rounded border-gray-300 dark:border-slate-500"
                          />
                          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: cat.barva }} />
                          <span className="text-sm text-gray-800 dark:text-slate-200 flex-1">{cat.nazev}</span>
                          {isSaving && <span className="text-xs text-gray-400">ukládám…</span>}
                          {checked && !isSaving && <span className="text-xs text-blue-500 dark:text-blue-400">✓</span>}
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className={label}>Popis</label>
                <textarea rows={3} value={form.popis} onChange={e => set('popis', e.target.value)} className={inp} placeholder="Volitelné" />
              </div>

              <div className="flex items-center gap-3">
                <label className={`${label} mb-0`}>Aktivní</label>
                <button
                  type="button"
                  onClick={() => set('aktivni', !form.aktivni)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${form.aktivni ? 'bg-primary' : 'bg-gray-300 dark:bg-slate-600'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.aktivni ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm text-gray-500 dark:text-slate-400">{form.aktivni ? 'Aktivní' : 'Neaktivní'}</span>
              </div>

              <div>
                <label className={label}>Sazba DPH</label>
                <div className="flex gap-2">
                  {[0, 12, 21].map(rate => (
                    <button
                      key={rate}
                      type="button"
                      onClick={() => set('dphSazba', String(rate))}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${form.dphSazba === String(rate) ? 'bg-primary text-white border-primary' : 'border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                    >
                      {rate} %
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Ceny */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Ceny</h2>
            <div className="grid grid-cols-3 gap-6">
              <div>
                <label className={label}>Nákupní cena (Kč)</label>
                <input
                  type="number" min="0" step="0.01"
                  value={form.nakladovaCena}
                  onChange={e => set('nakladovaCena', e.target.value)}
                  className={inp}
                  placeholder="Volitelné"
                />
              </div>
              <div>
                <label className={label}>Prodejní cena (Kč) *</label>
                <input
                  type="number" required min="0" step="0.01"
                  value={form.standardniCena}
                  onChange={e => set('standardniCena', e.target.value)}
                  className={inp}
                />
              </div>
              <div>
                <label className={label}>Marže</label>
                <div className="h-[38px] flex items-center">
                  <MarzeChip nakladova={nakCena} standardni={stdCena} />
                </div>
                {nakCena !== null && nakCena > 0 && stdCena > 0 && (
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                    {(() => {
                      const m = ((stdCena - nakCena) / nakCena) * 100
                      return `(prod. − nák.) / nák. = ${m >= 0 ? '+' : ''}${m.toFixed(1)} %`
                    })()}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Objednací informace */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Objednací informace</h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>Objednací kód (u dodavatele)</label>
                  <input type="text" value={form.objednaciKod} onChange={e => set('objednaciKod', e.target.value)} className={inp} placeholder="Kód u dodavatele" />
                </div>
                <div>
                  <label className={label}>Dodavatel</label>
                  <input type="text" value={form.dodavatel} onChange={e => set('dodavatel', e.target.value)} className={inp} placeholder="Název dodavatele" />
                </div>
              </div>
              <div>
                <label className={label}>Dodací lhůta</label>
                <input type="text" value={form.dodaciLhuta} onChange={e => set('dodaciLhuta', e.target.value)} className={inp} placeholder="Např. 3–5 pracovních dní" />
              </div>
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-6">

          {/* Historie */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Historie použití</h2>
            <div className="space-y-4">
              <div className="text-center py-2">
                <p className="text-3xl font-bold text-gray-900 dark:text-white">{usage.totalCount}</p>
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">krát použit v nabídkách</p>
              </div>
              {usage.lastUsed && (
                <div className="bg-gray-50 dark:bg-slate-900 rounded-lg px-4 py-3">
                  <p className="text-xs text-gray-500 dark:text-slate-400">Naposledy použit</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white mt-0.5">
                    {new Date(usage.lastUsed).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              )}
              {usage.totalCount === 0 && (
                <p className="text-sm text-gray-400 dark:text-slate-500 text-center">Produkt dosud nebyl použit v žádné nabídce.</p>
              )}
            </div>
          </div>

          {/* Ceníky */}
          <div className={sectionCard}>
            <h2 className={sectionTitle}>Ceníky</h2>
            {cenikPolozky.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">Produkt není zařazen v žádném ceníku.</p>
            ) : (
              <div className="space-y-2">
                {cenikPolozky.map(pol => (
                  <div key={pol.id} className="flex items-center justify-between gap-2 py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{pol.cenik.nazev}</p>
                      <p className="text-xs font-mono text-gray-400 dark:text-slate-500">{pol.cenik.kod}</p>
                    </div>
                    {editingCenikId === pol.id ? (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <input
                          autoFocus
                          type="number"
                          min="0"
                          step="0.01"
                          value={editingCena}
                          onChange={e => setEditingCena(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveCenikPrice(pol)
                            if (e.key === 'Escape') setEditingCenikId(null)
                          }}
                          className="w-28 border border-blue-400 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900 text-gray-900 dark:text-white focus:outline-none"
                        />
                        <button onClick={() => saveCenikPrice(pol)} disabled={savingCenik} className="text-xs text-green-600 dark:text-green-400 font-semibold px-1">✓</button>
                        <button onClick={() => setEditingCenikId(null)} className="text-xs text-gray-400 px-1">✕</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingCenikId(pol.id); setEditingCena(String(pol.cena)) }}
                        className="text-sm font-semibold text-gray-900 dark:text-white hover:text-primary dark:hover:text-primary-light tabular-nums flex-shrink-0"
                        title="Klikněte pro editaci"
                      >
                        {fmt(pol.cena)} Kč
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-400 dark:text-slate-500 mt-3">Klikněte na cenu pro inline editaci.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
