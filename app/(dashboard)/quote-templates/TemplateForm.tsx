'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import ProductCatalogModal from '@/components/ProductCatalogModal'
import { formatKcPresne } from '@/lib/format'

const techOptions = [
  { value: '', label: '— Všechny —' },
  { value: 'KLIMA', label: 'Klimatizace' },
  { value: 'TEPELNE_CERPADLO', label: 'Tepelné čerpadlo' },
  { value: 'REKUPERACE', label: 'Rekuperace' },
  { value: 'PODLAHOVE_TOPENI', label: 'Podlahové topení' },
  { value: 'VZDUCHOTECHNIKA', label: 'Vzduchotechnika' },
  { value: 'JINE', label: 'Jiné' },
]

interface TemplateItem {
  product_id?: string
  nazev: string
  mnozstvi: number
  cena_za_kus: number
  jednotka?: string
  sleva?: number
  poznamky?: string
}

interface Props {
  template?: { id: string; nazev: string; popis: string; technologie: string; polozky: TemplateItem[] }
}

export default function TemplateForm({ template }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [nazev, setNazev] = useState(template?.nazev ?? '')
  const [popis, setPopis] = useState(template?.popis ?? '')
  const [technologie, setTechnologie] = useState(template?.technologie ?? '')
  const [polozky, setPolozky] = useState<TemplateItem[]>(template?.polozky ?? [])
  const [showCatalogModal, setShowCatalogModal] = useState(false)

  function removeItem(idx: number) {
    setPolozky(polozky.filter((_, i) => i !== idx))
  }

  function updateItem(idx: number, field: keyof TemplateItem, value: string | number) {
    setPolozky(polozky.map((p, i) => i === idx ? { ...p, [field]: value } : p))
  }

  function addEmptyItem() {
    setPolozky(prev => [...prev, { nazev: '', mnozstvi: 1, cena_za_kus: 0 }])
  }

  async function handleCatalogAdd(items: { productId: string; nazev: string; cenaZaKus: number; mnozstvi: number; jednotka?: string }[]): Promise<void> {
    setShowCatalogModal(false)
    const newItems: TemplateItem[] = items.map(item => ({
      product_id: item.productId,
      nazev: item.nazev,
      mnozstvi: item.mnozstvi,
      cena_za_kus: item.cenaZaKus,
      jednotka: item.jednotka || 'ks',
    }))

    if (!template?.id) {
      // Nová šablona — zatím jen lokální stav, uloží se spolu s formulářem
      setPolozky(prev => [...prev, ...newItems])
      return
    }

    // Existující šablona — uloží položky ihned přes API
    setSaving(true)
    try {
      const res = await fetch(`/api/quote-templates/${template.id}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map(item => ({
            productId: item.productId,
            nazev: item.nazev,
            mnozstvi: item.mnozstvi,
            cenaZaKus: item.cenaZaKus,
            jednotka: item.jednotka || 'ks',
          })),
        }),
      })
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.polozky)) {
          setPolozky(data.polozky as TemplateItem[])
        }
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Nepodařilo se přidat položky')
      }
    } catch {
      setError('Chyba při přidávání položek')
    } finally {
      setSaving(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nazev) return
    setSaving(true)
    setError('')
    try {
      const url = template ? `/api/quote-templates/${template.id}` : '/api/quote-templates'
      const method = template ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nazev, popis, technologie: technologie || null, polozky }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      router.push('/quote-templates')
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
  const inpSm = 'border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg">{error}</div>}

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Základní informace</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Název šablony *</label>
            <input type="text" required value={nazev} onChange={(e) => setNazev(e.target.value)} className={inp} placeholder="Klimatizace RD — standardní sada" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Popis</label>
            <textarea rows={2} value={popis} onChange={(e) => setPopis(e.target.value)} className={inp} placeholder="Stručný popis použití šablony…" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Technologie</label>
            <select value={technologie} onChange={(e) => setTechnologie(e.target.value)} className={inp}>
              {techOptions.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Položky šablony</h2>
          </div>

          <table className="w-full">
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
              {polozky.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-400">Žádné položky.</td>
                </tr>
              )}
              {polozky.map((item, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input value={item.nazev} onChange={(e) => updateItem(idx, 'nazev', e.target.value)} className={`${inpSm} w-full`} placeholder="Název položky" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" step="0.001" value={item.mnozstvi} onChange={(e) => updateItem(idx, 'mnozstvi', Number(e.target.value))} className={`${inpSm} w-20 text-right`} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input type="number" min="0" step="0.01" value={item.cena_za_kus} onChange={(e) => updateItem(idx, 'cena_za_kus', Number(e.target.value))} className={`${inpSm} w-24 text-right`} />
                  </td>
                  <td className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
                    {formatKcPresne(item.mnozstvi * item.cena_za_kus)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => removeItem(idx)} className="text-xs text-red-500 hover:text-red-700">Odebrat</button>
                  </td>
                </tr>
              ))}
            </tbody>
            {polozky.length > 0 && (
              <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={3} className="px-6 py-3 text-sm font-semibold text-gray-700 text-right">Celkem:</td>
                  <td className="px-6 py-3 text-right font-bold text-gray-900">
                    {polozky.reduce((s, i) => s + i.mnozstvi * i.cena_za_kus, 0).toLocaleString('cs-CZ')} Kč
                  </td>
                  <td />
                </tr>
              </tfoot>
            )}
          </table>

          <div className="px-6 py-4 border-t border-gray-100 flex gap-2">
            <button
              type="button"
              onClick={() => setShowCatalogModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
            >
              + Přidat produkt
            </button>
            <button
              type="button"
              onClick={addEmptyItem}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200"
            >
              + Přidat vlastní položku
            </button>
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm">
            {saving ? 'Ukládám…' : template ? 'Uložit změny' : 'Vytvořit šablonu'}
          </button>
          <Link href="/quote-templates" className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900">Zrušit</Link>
        </div>
      </form>

      {showCatalogModal && (
        <ProductCatalogModal
          onClose={() => setShowCatalogModal(false)}
          onAdd={handleCatalogAdd}
        />
      )}
    </>
  )
}
