'use client'

import { confirmDialog } from '@/components/ui/confirm'
import { toast } from 'sonner'
import { useState, useEffect } from 'react'
import { ZakazkaPolozkaStav } from '@prisma/client'
import { formatKcPresne } from '@/lib/format'
import ProductCatalogModal from '@/components/ProductCatalogModal'

const fmtQty = (n: number) => n.toLocaleString('cs-CZ', { maximumFractionDigits: 3 })

const STAV_LABELS: Record<ZakazkaPolozkaStav, string> = {
  CEKA: 'Čeká',
  OBJEDNANO: 'Objednáno',
  NASKLADNENO: 'Rezervováno',
  VYDANO: 'Vydáno',
}

const STAV_COLORS: Record<ZakazkaPolozkaStav, string> = {
  CEKA: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  OBJEDNANO: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  NASKLADNENO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  VYDANO: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300',
}

interface Polozka {
  id: string
  productId: string | null
  nazev: string
  kod: string | null
  mnozstvi: number
  jednotka: string
  prodejniCena: number | null
  nakupniCena: number | null
  dphSazba: number
  stav: ZakazkaPolozkaStav
  poznamka: string | null
}

interface Props {
  zakazkaId: string
  polozky: Polozka[]
  /** zakazkyEdit — přidávání/úprava/mazání položek, Objednáno */
  canEdit: boolean
  /** sklad PLNY — rezervace ze skladu a storno rezervace */
  canSklad: boolean
  /** financeProdejni — prodejní ceny a celkem */
  showCeny: boolean
  /** financeNakupky — nákupní ceny */
  showNakupky: boolean
}

function NaskladnitModal({ polozka, zakazkaId, onClose, onDone }: {
  polozka: Polozka; zakazkaId: string; onClose: () => void; onDone: () => void
}) {
  const prodejni = polozka.prodejniCena

  const initNakupni = () => {
    if (polozka.nakupniCena !== null) return String(polozka.nakupniCena)
    return ''
  }
  const initRabat = () => {
    if (polozka.nakupniCena !== null && prodejni && prodejni > 0)
      return String(Math.round((1 - polozka.nakupniCena / prodejni) * 10000) / 100)
    return ''
  }

  const [mnozstvi, setMnozstvi] = useState(String(polozka.mnozstvi))
  const [mode, setMode] = useState<'kc' | 'pct'>(polozka.nakupniCena !== null ? 'kc' : (prodejni ? 'pct' : 'kc'))
  const [nakupniCena, setNakupniCena] = useState(initNakupni)
  const [rabat, setRabat] = useState(initRabat)
  const [poznamka, setPoznamka] = useState('')
  const [loading, setLoading] = useState(false)
  // Sklad v2: dostupné množství produktu (jen u položky s vazbou na katalog)
  const [stav, setStav] = useState<{ naSklade: number; rezervovano: number; dostupne: number } | null>(null)
  useEffect(() => {
    if (!polozka.productId) return
    fetch(`/api/sklad/zasoby?productId=${polozka.productId}`)
      .then(r => r.ok ? r.json() : null)
      .then(setStav)
      .catch(() => {})
  }, [polozka.productId])
  const chybi = stav ? Math.max(0, Number(mnozstvi || 0) - stav.dostupne) : 0

  const computedFromRabat = prodejni && rabat !== ''
    ? Math.round(prodejni * (1 - Number(rabat) / 100) * 100) / 100
    : null

  const finalNakupni = mode === 'pct' ? computedFromRabat : (nakupniCena !== '' ? Number(nakupniCena) : null)

  function handleModeSwitch(m: 'kc' | 'pct') {
    if (m === 'pct' && nakupniCena !== '' && prodejni && prodejni > 0) {
      setRabat(String(Math.round((1 - Number(nakupniCena) / prodejni) * 10000) / 100))
    }
    if (m === 'kc' && computedFromRabat !== null) {
      setNakupniCena(String(computedFromRabat))
    }
    setMode(m)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (finalNakupni === null) return
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/sklad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polozkaId: polozka.id, mnozstvi: Number(mnozstvi), nakupniCena: finalNakupni, poznamka }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.zakazkaNovyStav === 'V_REALIZACI') {
          toast.success('Rezervováno — zakázka automaticky přešla do realizace')
        } else if (data.stav && data.stav.dostupne < 0) {
          toast.warning(`Rezervováno nad dostupné množství — na skladě chybí ${fmtQty(-data.stav.dostupne)} ${polozka.jednotka}`)
        }
        onDone(); onClose()
      }
    } finally {
      setLoading(false)
    }
  }

  const fmtKc = formatKcPresne
  const inputCls = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white text-sm leading-snug">{polozka.nazev}</h3>
          {polozka.kod && <p className="font-mono text-xs text-gray-400 dark:text-slate-500 mt-0.5">{polozka.kod}</p>}
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">

          {/* Prodejní cena reference */}
          {prodejni !== null && (
            <div className="flex items-center justify-between bg-gray-50 dark:bg-slate-700/50 rounded-lg px-3 py-2">
              <span className="text-xs text-gray-500 dark:text-slate-400">Prod. cena z OP / ks</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-white">{fmtKc(prodejni)}</span>
            </div>
          )}

          {/* Dostupnost na skladě */}
          {stav && (
            <div className={`flex items-center justify-between rounded-lg px-3 py-2 ${chybi > 0 ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-gray-50 dark:bg-slate-700/50'}`}>
              <span className="text-xs text-gray-500 dark:text-slate-400">Dostupné na skladě</span>
              <span className={`text-sm font-semibold ${stav.dostupne <= 0 ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                {fmtQty(stav.dostupne)} {polozka.jednotka}
              </span>
            </div>
          )}

          {/* Množství */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Množství ({polozka.jednotka})</label>
            <input type="number" value={mnozstvi} onChange={e => setMnozstvi(e.target.value)} min="0.01" step="0.01" required className={inputCls} style={{ fontSize: 16 }} />
            {chybi > 0 && (
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                Na skladě chybí {fmtQty(chybi)} {polozka.jednotka} — rezervace projde, dostupné množství půjde do minusu.
              </p>
            )}
          </div>

          {/* Nákupní cena s přepínačem */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700 dark:text-slate-300">Nákupní cena / ks *</label>
              {prodejni !== null && (
                <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-slate-600 text-xs">
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('kc')}
                    className={`px-2.5 py-1 font-medium transition-colors ${mode === 'kc' ? 'bg-primary text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    Kč
                  </button>
                  <button
                    type="button"
                    onClick={() => handleModeSwitch('pct')}
                    className={`px-2.5 py-1 font-medium transition-colors border-l border-gray-300 dark:border-slate-600 ${mode === 'pct' ? 'bg-primary text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
                  >
                    % rabat
                  </button>
                </div>
              )}
            </div>

            {mode === 'kc' ? (
              <input
                type="number"
                value={nakupniCena}
                onChange={e => setNakupniCena(e.target.value)}
                min="0"
                step="0.01"
                required
                placeholder="0"
                className={inputCls}
                style={{ fontSize: 16 }}
              />
            ) : (
              <div className="space-y-1.5">
                <div className="relative">
                  <input
                    type="number"
                    value={rabat}
                    onChange={e => setRabat(e.target.value)}
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    placeholder="54"
                    className={inputCls}
                    style={{ fontSize: 16 }}
                    autoFocus
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 dark:text-slate-500 pointer-events-none">%</span>
                </div>
                {computedFromRabat !== null && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 pl-1">
                    → Nákupní cena: <span className="font-semibold text-gray-900 dark:text-white">{fmtKc(computedFromRabat)}</span>
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Poznámka */}
          <div>
            <label className="block text-xs font-medium text-gray-700 dark:text-slate-300 mb-1">Poznámka</label>
            <input type="text" value={poznamka} onChange={e => setPoznamka(e.target.value)} className={inputCls} style={{ fontSize: 16 }} />
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
            <button type="submit" disabled={loading || finalNakupni === null} className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Rezervovat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function StornoModal({ polozka, zakazkaId, onClose, onDone }: {
  polozka: Polozka; zakazkaId: string; onClose: () => void; onDone: () => void
}) {
  const [duvod, setDuvod] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/sklad/storno`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polozkaId: polozka.id, duvod }),
      })
      if (res.ok) { onDone(); onClose() }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Storno rezervace</h3>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <p className="text-sm text-gray-600 dark:text-slate-400">
            Opravdu chcete zrušit rezervaci pro <strong>{polozka.nazev}</strong>?
          </p>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Důvod storna *</label>
            <textarea value={duvod} onChange={e => setDuvod(e.target.value)} required rows={3} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
            <button type="submit" disabled={loading || !duvod.trim()} className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Stornovat'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function UpravitPolozkaModal({ polozka, zakazkaId, onClose, onDone }: {
  polozka: Polozka; zakazkaId: string; onClose: () => void; onDone: () => void
}) {
  const [nazev, setNazev] = useState(polozka.nazev)
  const [mnozstvi, setMnozstvi] = useState(String(polozka.mnozstvi))
  const [jednotka, setJednotka] = useState(polozka.jednotka)
  const [prodejniCena, setProdejniCena] = useState(polozka.prodejniCena !== null ? String(polozka.prodejniCena) : '')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/polozky`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polozkaId: polozka.id,
          nazev,
          mnozstvi: Number(mnozstvi),
          jednotka,
          prodejniCena: prodejniCena !== '' ? Number(prodejniCena) : null,
        }),
      })
      if (res.ok) { onDone(); onClose() }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-sm">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-semibold text-gray-900 dark:text-white">Upravit položku</h3>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Název *</label>
            <input type="text" value={nazev} onChange={e => setNazev(e.target.value)} required className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Množství</label>
              <input type="number" value={mnozstvi} onChange={e => setMnozstvi(e.target.value)} min="0.01" step="0.01" className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Jednotka</label>
              <input type="text" value={jednotka} onChange={e => setJednotka(e.target.value)} className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Prod. cena / ks (Kč)</label>
            <input type="number" value={prodejniCena} onChange={e => setProdejniCena(e.target.value)} min="0" step="0.01" className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary" />
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
            <button type="submit" disabled={loading || !nazev.trim()} className="px-3 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
              {loading ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

type NewRow = { nazev: string; kod: string; mnozstvi: string; jednotka: string; prodejniCena: string }

export default function PolozkyTab({ zakazkaId, polozky: initialPolozky, canEdit, canSklad, showCeny, showNakupky }: Props) {
  const canActions = canEdit || canSklad
  const [polozky, setPolozky] = useState(initialPolozky)
  const [naskladnitModal, setNaskladnitModal] = useState<Polozka | null>(null)
  const [stornoModal, setStornoModal] = useState<Polozka | null>(null)
  const [newRow, setNewRow] = useState<NewRow | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const [upravitModal, setUpravitModal] = useState<Polozka | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showCatalog, setShowCatalog] = useState(false)

  /** Položky z katalogu produktů — s vazbou productId (sklad v2 podle ní vede zásobu). */
  async function handleAddFromCatalog(items: { productId: string; kod: string | null; nazev: string; cenaZaKus: number; mnozstvi: number; jednotka?: string }[]) {
    setShowCatalog(false)
    for (const it of items) {
      await fetch(`/api/zakazky/${zakazkaId}/polozky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: it.productId,
          nazev: it.nazev,
          kod: it.kod,
          mnozstvi: it.mnozstvi,
          jednotka: it.jednotka ?? 'ks',
          prodejniCena: it.cenaZaKus,
        }),
      })
    }
    refreshPolozky()
  }

  async function refreshPolozky() {
    const res = await fetch(`/api/zakazky/${zakazkaId}/polozky`)
    if (res.ok) {
      const data = await res.json()
      setPolozky(data.map((p: Record<string, unknown>) => ({ ...p, mnozstvi: Number(p.mnozstvi), prodejniCena: p.prodejniCena !== null ? Number(p.prodejniCena) : null, nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null })))
    }
  }

  async function handleObjednano(polozka: Polozka) {
    await fetch(`/api/zakazky/${zakazkaId}/polozky`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ polozkaId: polozka.id, stav: 'OBJEDNANO' }),
    })
    refreshPolozky()
  }

  async function handleSmazat(polozka: Polozka) {
    if (!(await confirmDialog(`Opravdu smazat položku "${polozka.nazev}"?`, { confirmLabel: 'Smazat' }))) return
    setDeletingId(polozka.id)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/polozky`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ polozkaId: polozka.id }),
      })
      if (res.ok) setPolozky(prev => prev.filter(p => p.id !== polozka.id))
    } finally {
      setDeletingId(null)
    }
  }

  async function handleSaveNewRow() {
    if (!newRow || !newRow.nazev.trim()) return
    setSavingNew(true)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/polozky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: newRow.nazev,
          kod: newRow.kod || null,
          mnozstvi: Number(newRow.mnozstvi),
          jednotka: newRow.jednotka,
          prodejniCena: newRow.prodejniCena ? Number(newRow.prodejniCena) : null,
        }),
      })
      if (res.ok) { setNewRow(null); refreshPolozky() }
    } finally {
      setSavingNew(false)
    }
  }

  function startNewRow() {
    setNewRow({ nazev: '', kod: '', mnozstvi: '1', jednotka: 'ks', prodejniCena: '' })
  }

  const inputCls = 'border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary'

  return (
    <>
      {showCatalog && <ProductCatalogModal onClose={() => setShowCatalog(false)} onAdd={handleAddFromCatalog} />}
      {naskladnitModal && (
        <NaskladnitModal
          polozka={naskladnitModal}
          zakazkaId={zakazkaId}
          onClose={() => setNaskladnitModal(null)}
          onDone={refreshPolozky}
        />
      )}
      {stornoModal && (
        <StornoModal
          polozka={stornoModal}
          zakazkaId={zakazkaId}
          onClose={() => setStornoModal(null)}
          onDone={refreshPolozky}
        />
      )}
      {upravitModal && (
        <UpravitPolozkaModal
          polozka={upravitModal}
          zakazkaId={zakazkaId}
          onClose={() => setUpravitModal(null)}
          onDone={refreshPolozky}
        />
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Položky ({polozky.length})</h3>
          {canEdit && (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowCatalog(true)}
                className="text-sm font-medium text-primary dark:text-primary-light hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                Z katalogu
              </button>
              <button
                onClick={startNewRow}
                className="text-sm font-medium text-primary dark:text-primary-light hover:underline flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Ručně
              </button>
            </div>
          )}
        </div>

        {polozky.length === 0 && !newRow ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Žádné položky</div>
        ) : (
          <>
            {/* Mobile card layout */}
            <div className="sm:hidden divide-y divide-gray-100 dark:divide-slate-700">
              {polozky.map(p => (
                <div key={p.id} className="px-4 py-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white text-sm leading-tight">{p.nazev}</p>
                      {p.kod && <p className="font-mono text-xs text-gray-400 dark:text-slate-500 mt-0.5">{p.kod}</p>}
                    </div>
                    <span className={`flex-shrink-0 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[p.stav]}`}>
                      {STAV_LABELS[p.stav]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-600 dark:text-slate-400">
                    <span>{Number(p.mnozstvi)} {p.jednotka}</span>
                    {showCeny && p.prodejniCena !== null && (
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatKcPresne(Number(p.mnozstvi) * Number(p.prodejniCena))}
                      </span>
                    )}
                  </div>
                  {canActions && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {p.stav === 'CEKA' && (
                        <>
                          {canEdit && (
                          <button onClick={() => handleObjednano(p)} className="text-xs px-2.5 py-1.5 text-primary dark:text-primary-light border border-blue-300 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20">
                            Objednáno
                          </button>
                          )}
                          {canSklad && (
                          <button onClick={() => setNaskladnitModal(p)} className="text-xs px-2.5 py-1.5 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                            Rezervovat
                          </button>
                          )}
                          {canEdit && (
                          <button onClick={() => setUpravitModal(p)} className="text-xs px-2.5 py-1.5 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                            Upravit
                          </button>
                          )}
                          {canEdit && (
                          <button onClick={() => handleSmazat(p)} disabled={deletingId === p.id} className="text-xs px-2.5 py-1.5 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                            Smazat
                          </button>
                          )}
                        </>
                      )}
                      {p.stav === 'OBJEDNANO' && canSklad && (
                        <button onClick={() => setNaskladnitModal(p)} className="text-xs px-2.5 py-1.5 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20">
                          Rezervovat
                        </button>
                      )}
                      {p.stav === 'NASKLADNENO' && canSklad && (
                        <button onClick={() => setStornoModal(p)} className="text-xs px-2.5 py-1.5 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20">
                          Storno rezervace
                        </button>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {newRow !== null && (
                <div className="px-4 py-3 space-y-2 bg-blue-50/50 dark:bg-blue-900/10">
                  <input
                    value={newRow.nazev}
                    onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })}
                    placeholder="Název *"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') handleSaveNewRow(); if (e.key === 'Escape') setNewRow(null) }}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      value={newRow.kod}
                      onChange={e => setNewRow(r => r && { ...r, kod: e.target.value })}
                      placeholder="Kód"
                      className="flex-1 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      type="number"
                      value={newRow.mnozstvi}
                      onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })}
                      placeholder="Mn."
                      min="0.01"
                      step="0.01"
                      className="w-16 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <input
                      value={newRow.jednotka}
                      onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })}
                      placeholder="Jed."
                      className="w-14 border border-gray-300 dark:border-slate-600 rounded-lg px-2 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                  {showCeny && (
                    <input
                      type="number"
                      value={newRow.prodejniCena}
                      onChange={e => setNewRow(r => r && { ...r, prodejniCena: e.target.value })}
                      placeholder="Prod. cena / ks (Kč)"
                      min="0"
                      step="0.01"
                      className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  )}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveNewRow}
                      disabled={savingNew || !newRow.nazev.trim()}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50"
                    >
                      {savingNew ? 'Ukládám…' : 'Uložit'}
                    </button>
                    <button
                      onClick={() => setNewRow(null)}
                      className="px-3 py-1.5 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg"
                    >
                      Zrušit
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30">
                    {canEdit && <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Kód</th>}
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Název</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Mn.</th>
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Jed.</th>
                    {showNakupky && <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">NK. cena</th>}
                    {showCeny && (
                      <>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Pr. cena</th>
                        <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Celkem</th>
                      </>
                    )}
                    <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Stav</th>
                    {canActions && <th className="px-4 py-2.5" />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {polozky.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      {canEdit && <td className="px-4 py-3 font-mono text-xs text-gray-400 dark:text-slate-500">{p.kod ?? '—'}</td>}
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">{p.nazev}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{Number(p.mnozstvi)}</td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-500 text-xs">{p.jednotka}</td>
                      {showNakupky && (
                        <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">
                          {p.nakupniCena !== null ? `${formatKcPresne(Number(p.nakupniCena))}` : '—'}
                        </td>
                      )}
                      {showCeny && (
                        <>
                          <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">
                            {p.prodejniCena !== null ? `${formatKcPresne(Number(p.prodejniCena))}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">
                            {p.prodejniCena !== null
                              ? `${formatKcPresne((Number(p.mnozstvi) * Number(p.prodejniCena)))}`
                              : '—'}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[p.stav]}`}>
                          {STAV_LABELS[p.stav]}
                        </span>
                      </td>
                      {canActions && (
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            {p.stav === 'CEKA' && (
                              <>
                                {canEdit && (
                                <button
                                  onClick={() => handleObjednano(p)}
                                  className="text-xs px-2 py-1 text-primary dark:text-primary-light border border-blue-300 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                >
                                  Objednáno
                                </button>
                                )}
                                {canSklad && (
                                <button
                                  onClick={() => setNaskladnitModal(p)}
                                  className="text-xs px-2 py-1 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                                >
                                  Rezervovat
                                </button>
                                )}
                                {canEdit && (
                                <button
                                  onClick={() => setUpravitModal(p)}
                                  className="text-xs px-2 py-1 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded hover:bg-gray-50 dark:hover:bg-slate-700"
                                >
                                  Upravit
                                </button>
                                )}
                                {canEdit && (
                                <button
                                  onClick={() => handleSmazat(p)}
                                  disabled={deletingId === p.id}
                                  className="text-xs px-2 py-1 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50"
                                >
                                  Smazat
                                </button>
                                )}
                              </>
                            )}
                            {p.stav === 'OBJEDNANO' && canSklad && (
                              <button
                                onClick={() => setNaskladnitModal(p)}
                                className="text-xs px-2 py-1 text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded hover:bg-green-50 dark:hover:bg-green-900/20"
                              >
                                Rezervovat
                              </button>
                            )}
                            {p.stav === 'NASKLADNENO' && canSklad && (
                              <button
                                onClick={() => setStornoModal(p)}
                                className="text-xs px-2 py-1 text-red-600 dark:text-red-400 border border-red-300 dark:border-red-700 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Storno rezervace
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {newRow !== null && (
                    <tr className="bg-blue-50/50 dark:bg-blue-900/10">
                      {canEdit && (
                        <td className="px-4 py-2">
                          <input
                            value={newRow.kod}
                            onChange={e => setNewRow(r => r && { ...r, kod: e.target.value })}
                            placeholder="Kód"
                            className={`${inputCls} font-mono w-24`}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2">
                        <input
                          value={newRow.nazev}
                          onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })}
                          placeholder="Název *"
                          autoFocus
                          onKeyDown={e => { if (e.key === 'Enter') handleSaveNewRow(); if (e.key === 'Escape') setNewRow(null) }}
                          className={`${inputCls} font-medium`}
                          style={{ minWidth: 140 }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={newRow.mnozstvi}
                          onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })}
                          min="0.01"
                          step="0.01"
                          className={inputCls}
                          style={{ width: 60 }}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={newRow.jednotka}
                          onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })}
                          className={inputCls}
                          style={{ width: 44 }}
                        />
                      </td>
                      {showNakupky && <td className="px-4 py-2 text-right text-gray-400 dark:text-slate-600 text-xs">—</td>}
                      {showCeny && (
                        <>
                          <td className="px-4 py-2">
                            <input
                              type="number"
                              value={newRow.prodejniCena}
                              onChange={e => setNewRow(r => r && { ...r, prodejniCena: e.target.value })}
                              placeholder="0"
                              min="0"
                              step="0.01"
                              className={`${inputCls} text-right`}
                              style={{ width: 80 }}
                            />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 dark:text-slate-600 text-xs">—</td>
                        </>
                      )}
                      <td className="px-4 py-2 text-gray-400 dark:text-slate-600 text-xs">—</td>
                      {canEdit && (
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1">
                            <button
                              onClick={handleSaveNewRow}
                              disabled={savingNew || !newRow.nazev.trim()}
                              className="text-xs px-2 py-1 text-white bg-primary hover:bg-primary-hover rounded disabled:opacity-50"
                            >
                              {savingNew ? '…' : 'Uložit'}
                            </button>
                            <button
                              onClick={() => setNewRow(null)}
                              className="text-xs px-2 py-1 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded"
                            >
                              Zrušit
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </>
  )
}
