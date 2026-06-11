'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { VyuctovaniStav } from '@prisma/client'

const STAV_LABELS: Record<VyuctovaniStav, string> = {
  NAVRH: 'Návrh',
  KE_SCHVALENI: 'Ke schválení',
  SCHVALENO: 'Schváleno',
}
const STAV_COLORS: Record<VyuctovaniStav, string> = {
  NAVRH: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  KE_SCHVALENI: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  SCHVALENO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

interface Polozka {
  id: string
  nazev: string
  mnozstvi: number
  jednotka: string
  nakupniCena: number | null
  prodejniCena: number
  dphSazba: number
  poradi: number
}

interface VyuctovaniData {
  id: string
  cislo: string
  stav: VyuctovaniStav
  poznamka: string
  vytvoreno: string
  schvaleno: string | null
  schvalil: { jmeno: string } | null
  zakazka: {
    id: string; cislo: string; nazev: string
    klient: { jmeno: string; prijmeni: string }
    vedouci: { id: string; jmeno: string } | null
  }
  polozky: Polozka[]
}

interface Props {
  vyuctovani: VyuctovaniData
  role: string
  defaultDph?: number
}

function fmtKc(v: number) {
  return v.toLocaleString('cs-CZ', { maximumFractionDigits: 0 }) + ' Kč'
}

type NewRow = { nazev: string; mnozstvi: string; jednotka: string; prodejniCena: string; nakupniCena: string; dphSazba: number }

export default function VyuctovaniDetailClient({ vyuctovani: initial, role, defaultDph }: Props) {
  const router = useRouter()
  const isAdmin = role === 'ADMIN'

  const [stav, setStav] = useState<VyuctovaniStav>(initial.stav)
  const canEdit = stav !== 'SCHVALENO'
  const [polozky, setPolozky] = useState<Polozka[]>(initial.polozky)
  const [poznamka, setPoznamka] = useState(initial.poznamka)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [newRow, setNewRow] = useState<NewRow | null>(null)
  const [savingNew, setSavingNew] = useState(false)
  const [confirmSchvalit, setConfirmSchvalit] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (toast) { const t = setTimeout(() => setToast(null), 3000); return () => clearTimeout(t) }
  }, [toast])

  // Live calculation
  const celkemBezDph = polozky.reduce((s, p) => s + p.mnozstvi * p.prodejniCena, 0)
  const celkemDph = polozky.reduce((s, p) => s + p.mnozstvi * p.prodejniCena * (p.dphSazba / 100), 0)
  const celkemSDph = celkemBezDph + celkemDph
  const nakupniNaklady = polozky.reduce((s, p) => s + p.mnozstvi * (p.nakupniCena ?? 0), 0)
  const hrubaMarze = celkemBezDph - nakupniNaklady
  const marzeProc = celkemBezDph > 0 ? (hrubaMarze / celkemBezDph) * 100 : 0
  const hasNakupni = polozky.some(p => p.nakupniCena !== null && p.nakupniCena > 0)

  async function handleUpdatePolozka(polozkaId: string, field: string, value: string | number) {
    const res = await fetch(`/api/vyuctovani/${initial.id}/polozky/${polozkaId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: value }),
    })
    if (res.ok) {
      const updated = await res.json()
      setPolozky(prev => prev.map(p => p.id === polozkaId ? { ...p, [field]: value, ...updated } : p))
    }
  }

  async function handleDeletePolozka(polozkaId: string) {
    const res = await fetch(`/api/vyuctovani/${initial.id}/polozky/${polozkaId}`, { method: 'DELETE' })
    if (res.ok) setPolozky(prev => prev.filter(p => p.id !== polozkaId))
  }

  async function handleSaveNewRow() {
    if (!newRow || !newRow.nazev.trim()) return
    setSavingNew(true)
    try {
      const res = await fetch(`/api/vyuctovani/${initial.id}/polozky`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nazev: newRow.nazev,
          mnozstvi: Number(newRow.mnozstvi),
          jednotka: newRow.jednotka,
          prodejniCena: Number(newRow.prodejniCena),
          nakupniCena: newRow.nakupniCena ? Number(newRow.nakupniCena) : null,
          dphSazba: newRow.dphSazba,
        }),
      })
      if (res.ok) {
        const p = await res.json()
        setPolozky(prev => [...prev, {
          ...p,
          mnozstvi: Number(p.mnozstvi),
          prodejniCena: Number(p.prodejniCena),
          nakupniCena: p.nakupniCena !== null ? Number(p.nakupniCena) : null,
          dphSazba: Number(p.dphSazba),
        }])
        setNewRow(null)
      }
    } finally {
      setSavingNew(false)
    }
  }

  function startNewRow() {
    const lastDph = polozky.length > 0 ? polozky[polozky.length - 1].dphSazba : (defaultDph ?? 12)
    setNewRow({ nazev: '', mnozstvi: '1', jednotka: 'ks', prodejniCena: '', nakupniCena: '', dphSazba: lastDph })
  }

  async function handleKeSchvaleni() {
    setLoading(true)
    try {
      // Save poznamka first
      await fetch(`/api/vyuctovani/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poznamka }),
      })
      const res = await fetch(`/api/vyuctovani/${initial.id}/ke-schvaleni`, { method: 'POST' })
      if (res.ok) { setStav('KE_SCHVALENI'); setToast('Odesláno ke schválení') }
    } finally { setLoading(false) }
  }

  async function handleSchvalit() {
    setConfirmSchvalit(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/vyuctovani/${initial.id}/schvalit`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setStav('SCHVALENO')
        setToast(data.zakazkaNovyStav === 'VYUCTOVANA'
          ? 'Vyúčtování schváleno — zakázka automaticky označena jako Vyúčtovaná'
          : 'Vyúčtování schváleno')
        router.refresh()
      }
    } finally { setLoading(false) }
  }

  async function handleVratit() {
    setLoading(true)
    try {
      const res = await fetch(`/api/vyuctovani/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav: 'NAVRH' }),
      })
      if (res.ok) { setStav('NAVRH'); setToast('Vráceno k úpravám') }
    } finally { setLoading(false) }
  }

  async function handleReopenSchvaleno() {
    setLoading(true)
    try {
      const res = await fetch(`/api/vyuctovani/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav: 'NAVRH' }),
      })
      if (res.ok) { setStav('NAVRH'); setToast('Vyúčtování vráceno k úpravám') }
    } finally { setLoading(false) }
  }

  async function handleDelete() {
    setConfirmDelete(false)
    setLoading(true)
    try {
      const res = await fetch(`/api/vyuctovani/${initial.id}`, { method: 'DELETE' })
      if (res.ok) {
        setToast('Vyúčtování smazáno')
        router.push(`/zakazky/${initial.zakazka.id}?tab=vyuctovani`)
      } else {
        const err = await res.json()
        setToast(err.error ?? 'Chyba při mazání')
      }
    } finally { setLoading(false) }
  }

  function EditableCell({ value, polozkaId, field, type = 'text' }: { value: string | number; polozkaId: string; field: string; type?: string }) {
    const [v, setV] = useState(String(value))
    if (!canEdit) return <span>{type === 'number' ? Number(value).toLocaleString('cs-CZ') : value}</span>
    return (
      <input
        type={type}
        value={v}
        onChange={e => setV(e.target.value)}
        onBlur={() => {
          const parsed = type === 'number' ? Number(v) : v
          if (String(parsed) !== String(value)) handleUpdatePolozka(polozkaId, field, parsed)
        }}
        className="w-full border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5 text-right"
        style={{ minWidth: type === 'number' ? 70 : 120 }}
      />
    )
  }

  const inputCls = 'border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary rounded px-1 py-0.5'

  return (
    <>
      {toast && (
        <div className="fixed bottom-6 right-4 z-50 px-4 py-3 rounded-xl shadow-xl bg-green-600 text-white text-sm font-medium">{toast}</div>
      )}
      {confirmSchvalit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Schválit vyúčtování?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">Schválením bude stav zakázky změněn na <strong>Vyúčtována</strong>.</p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmSchvalit(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleSchvalit} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">Schválit</button>
            </div>
          </div>
        </div>
      )}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-xl max-w-sm w-full">
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Smazat vyúčtování?</h3>
            <p className="text-sm text-gray-600 dark:text-slate-400 mb-5">
              Vyúčtování <strong>{initial.cislo}</strong> včetně všech položek bude <strong>trvale smazáno</strong>. Tuto akci nelze vzít zpět.
            </p>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg">Zrušit</button>
              <button onClick={handleDelete} disabled={loading} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">
                {loading ? 'Mažu…' : 'Smazat'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-5 pb-32 md:pb-6">
        {/* Header */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-5">
          <div className="flex flex-col gap-3">
            {/* Breadcrumb */}
            <div className="flex items-center gap-1.5 text-sm text-gray-400 dark:text-slate-500">
              <a href={`/zakazky/${initial.zakazka.id}?tab=vyuctovani`} className="hover:text-gray-600 dark:hover:text-slate-300 transition-colors">{initial.zakazka.cislo}</a>
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
              <span className="text-gray-600 dark:text-slate-300 font-medium">{initial.cislo}</span>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <span className="font-mono text-2xl font-bold text-[#1B5E20] dark:text-green-400">{initial.cislo}</span>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[stav]}`}>{STAV_LABELS[stav]}</span>
            </div>
            <p className="text-sm text-gray-600 dark:text-slate-400">
              {initial.zakazka.nazev}
              {initial.schvalil && ` · Schválil: ${initial.schvalil.jmeno}`}
            </p>
            {/* Desktop action buttons */}
            <div className="hidden md:flex items-center gap-2 flex-wrap">
              {stav === 'NAVRH' && (
                <>
                  {isAdmin && (
                    <button onClick={() => setConfirmDelete(true)} disabled={loading} className="text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg disabled:opacity-50">Smazat</button>
                  )}
                  <button onClick={() => { fetch(`/api/vyuctovani/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poznamka }) }); setToast('Uloženo') }} disabled={loading} className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Uložit</button>
                  <button onClick={handleKeSchvaleni} disabled={loading} className="text-sm font-medium text-white bg-[#1B5E20] hover:bg-green-800 px-3 py-2 rounded-lg disabled:opacity-50">{loading ? '…' : 'Odeslat ke schválení'}</button>
                </>
              )}
              {stav === 'KE_SCHVALENI' && isAdmin && (
                <>
                  <button onClick={() => setConfirmDelete(true)} disabled={loading} className="text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg disabled:opacity-50">Smazat</button>
                  <button onClick={handleVratit} disabled={loading} className="text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 disabled:opacity-50">Vrátit k úpravám</button>
                  <button onClick={() => setConfirmSchvalit(true)} disabled={loading} className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-2 rounded-lg disabled:opacity-50">Schválit</button>
                </>
              )}
              {stav === 'SCHVALENO' && (
                <>
                  {isAdmin && (
                    <>
                      <button onClick={() => setConfirmDelete(true)} disabled={loading} className="text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-2 rounded-lg disabled:opacity-50">Smazat</button>
                      <button onClick={handleReopenSchvaleno} disabled={loading} className="text-sm font-medium text-orange-700 dark:text-orange-400 border border-orange-300 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-2 rounded-lg disabled:opacity-50">
                        {loading ? '…' : 'Vrátit k úpravám'}
                      </button>
                    </>
                  )}
                  <a href={`/api/vyuctovani/${initial.id}/pdf`} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300 border border-gray-300 dark:border-slate-600 px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    Stáhnout PDF
                  </a>
                  <button title="Připravujeme" disabled className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-400 dark:text-slate-500 border border-gray-200 dark:border-slate-700 px-3 py-2 rounded-lg cursor-not-allowed opacity-60">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    Odeslat klientovi
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Polozky — desktop table */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Položky ({polozky.length})</h2>
            {canEdit && (
              <button onClick={startNewRow} className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1B5E20] hover:bg-green-800 px-3 py-2 rounded-lg transition-colors min-h-[40px]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                <span className="hidden sm:inline">Přidat položku</span>
                <span className="sm:hidden">Přidat</span>
              </button>
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30">
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase w-8">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Název</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Mn.</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Jed.</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">NK. cena</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">PR. cena</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">DPH%</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">Bez DPH</th>
                  <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase">S DPH</th>
                  {canEdit && <th className="px-4 py-2.5 w-8" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                {polozky.map((p, idx) => {
                  const bezDph = p.mnozstvi * p.prodejniCena
                  const sDph = bezDph * (1 + p.dphSazba / 100)
                  return (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30">
                      <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white font-medium">
                        {canEdit ? (
                          <input
                            type="text"
                            defaultValue={p.nazev}
                            onBlur={e => { if (e.target.value !== p.nazev) handleUpdatePolozka(p.id, 'nazev', e.target.value) }}
                            className="w-full border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 py-0.5"
                          />
                        ) : p.nazev}
                      </td>
                      <td className="px-4 py-3 text-right"><EditableCell value={p.mnozstvi} polozkaId={p.id} field="mnozstvi" type="number" /></td>
                      <td className="px-4 py-3 text-gray-500 dark:text-slate-400 text-xs">{p.jednotka}</td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400">
                        <EditableCell value={p.nakupniCena ?? 0} polozkaId={p.id} field="nakupniCena" type="number" />
                      </td>
                      <td className="px-4 py-3 text-right"><EditableCell value={p.prodejniCena} polozkaId={p.id} field="prodejniCena" type="number" /></td>
                      <td className="px-4 py-3 text-right text-gray-500 dark:text-slate-400 text-xs">
                        {canEdit ? (
                          <select value={p.dphSazba} onChange={e => handleUpdatePolozka(p.id, 'dphSazba', Number(e.target.value))}
                            className="border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 py-0.5">
                            <option value="0">0 %</option>
                            <option value="12">12 %</option>
                            <option value="21">21 %</option>
                          </select>
                        ) : `${p.dphSazba} %`}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">{fmtKc(bezDph)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-white">{fmtKc(sDph)}</td>
                      {canEdit && (
                        <td className="px-4 py-3">
                          <button onClick={() => handleDeletePolozka(p.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 text-xs">×</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
                {canEdit && newRow !== null && (
                  <tr className="bg-green-50/50 dark:bg-green-900/10">
                    <td className="px-4 py-2 text-gray-400 text-xs">—</td>
                    <td className="px-4 py-2">
                      <input value={newRow.nazev} onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })} placeholder="Název *" autoFocus
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveNewRow(); if (e.key === 'Escape') setNewRow(null) }}
                        className="w-full border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 py-0.5" style={{ minWidth: 140 }} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" value={newRow.mnozstvi} onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })} min="0.01" step="0.01" className={`${inputCls} text-right`} style={{ minWidth: 60 }} />
                    </td>
                    <td className="px-4 py-2">
                      <input value={newRow.jednotka} onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })} className={`${inputCls} text-left`} style={{ width: 44 }} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" value={newRow.nakupniCena} onChange={e => setNewRow(r => r && { ...r, nakupniCena: e.target.value })} placeholder="0" min="0" step="0.01" className={`${inputCls} text-right`} style={{ minWidth: 70 }} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <input type="number" value={newRow.prodejniCena} onChange={e => setNewRow(r => r && { ...r, prodejniCena: e.target.value })} placeholder="0" min="0" step="0.01" className={`${inputCls} text-right`} style={{ minWidth: 70 }} />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <select value={newRow.dphSazba} onChange={e => setNewRow(r => r && { ...r, dphSazba: Number(e.target.value) })}
                        className="border-0 bg-transparent text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-green-500 rounded px-1 py-0.5">
                        <option value="0">0 %</option>
                        <option value="12">12 %</option>
                        <option value="21">21 %</option>
                      </select>
                    </td>
                    <td className="px-4 py-2 text-right text-gray-400 dark:text-slate-600 text-xs">—</td>
                    <td className="px-4 py-2 text-right text-gray-400 dark:text-slate-600 text-xs">—</td>
                    <td className="px-4 py-2">
                      <div className="flex gap-1">
                        <button onClick={handleSaveNewRow} disabled={savingNew || !newRow.nazev.trim()} className="text-xs px-2 py-1 text-white bg-[#1B5E20] hover:bg-green-800 rounded disabled:opacity-50">{savingNew ? '…' : 'Uložit'}</button>
                        <button onClick={() => setNewRow(null)} className="text-xs px-2 py-1 text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded">Zrušit</button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile card layout */}
          <div className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
            {canEdit && newRow !== null && (
              <div className="px-4 py-4 space-y-3 bg-green-50/50 dark:bg-green-900/10">
                <p className="text-xs font-semibold text-[#1B5E20] dark:text-green-400 uppercase">Nová položka</p>
                <input value={newRow.nazev} onChange={e => setNewRow(r => r && { ...r, nazev: e.target.value })} placeholder="Název *" autoFocus
                  style={{ fontSize: 16 }} className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Množství</label>
                    <input type="number" inputMode="decimal" value={newRow.mnozstvi} onChange={e => setNewRow(r => r && { ...r, mnozstvi: e.target.value })} min="0.01" step="0.01"
                      style={{ fontSize: 16 }} className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Jednotka</label>
                    <input value={newRow.jednotka} onChange={e => setNewRow(r => r && { ...r, jednotka: e.target.value })}
                      style={{ fontSize: 16 }} className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">Prodejní cena (Kč)</label>
                    <input type="number" inputMode="decimal" value={newRow.prodejniCena} onChange={e => setNewRow(r => r && { ...r, prodejniCena: e.target.value })} placeholder="0" min="0" step="0.01"
                      style={{ fontSize: 16 }} className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1">DPH</label>
                    <select value={newRow.dphSazba} onChange={e => setNewRow(r => r && { ...r, dphSazba: Number(e.target.value) })}
                      style={{ fontSize: 16 }} className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1B5E20] min-h-[48px]">
                      <option value="0">0 %</option>
                      <option value="12">12 %</option>
                      <option value="21">21 %</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-3">
                  <button onClick={handleSaveNewRow} disabled={savingNew || !newRow.nazev.trim()} className="flex-1 bg-[#1B5E20] text-white rounded-xl py-3 font-medium text-sm disabled:opacity-50 min-h-[48px]">
                    {savingNew ? 'Ukládám…' : 'Uložit'}
                  </button>
                  <button onClick={() => setNewRow(null)} className="flex-1 border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-300 rounded-xl py-3 font-medium text-sm min-h-[48px]">Zrušit</button>
                </div>
              </div>
            )}
            {polozky.map((p) => {
              const bezDph = p.mnozstvi * p.prodejniCena
              const sDph = bezDph * (1 + p.dphSazba / 100)
              return (
                <div key={p.id} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white text-sm leading-tight">{p.nazev}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">{p.mnozstvi} {p.jednotka} · DPH {p.dphSazba} %</p>
                    </div>
                    {canEdit && (
                      <button onClick={() => handleDeletePolozka(p.id)} className="text-red-400 hover:text-red-600 p-1 flex-shrink-0">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-slate-400">Bez DPH: {fmtKc(bezDph)}</span>
                    <span className="font-bold text-gray-900 dark:text-white text-base">{fmtKc(sDph)}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Celková částka — prominent on mobile */}
        <div className="bg-[#1B5E20] rounded-xl px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-200 text-sm font-medium">Celkem s DPH</p>
              <p className="text-white text-3xl font-bold mt-0.5">{fmtKc(celkemSDph)}</p>
            </div>
            <div className="text-right">
              <p className="text-green-200 text-xs">Bez DPH</p>
              <p className="text-white font-semibold">{fmtKc(celkemBezDph)}</p>
              <p className="text-green-300 text-xs mt-0.5">DPH {fmtKc(celkemDph)}</p>
            </div>
          </div>
          {hasNakupni && (
            <div className="border-t border-green-700 mt-3 pt-3 flex items-center justify-between text-sm">
              <span className="text-green-200">Hrubá marže:</span>
              <span className={`font-bold text-base ${hrubaMarze >= 0 ? 'text-white' : 'text-red-300'}`}>
                {fmtKc(hrubaMarze)} ({marzeProc.toFixed(1)} %)
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Souhrn — desktop only (mobile has the prominent card above) */}
          <div className="hidden md:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-4">Souhrn</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">Celkem bez DPH:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{fmtKc(celkemBezDph)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-slate-400">DPH:</span>
                <span className="text-gray-700 dark:text-slate-300">{fmtKc(celkemDph)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-100 dark:border-slate-700 pt-2 mt-2">
                <span className="font-semibold text-gray-900 dark:text-white">Celkem s DPH:</span>
                <span className="text-xl font-bold text-gray-900 dark:text-white">{fmtKc(celkemSDph)}</span>
              </div>
              {hasNakupni && (
                <div className="border-t border-gray-100 dark:border-slate-700 pt-2 mt-2 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-500">Nákupní náklady:</span>
                    <span className="text-gray-600 dark:text-slate-400">{fmtKc(nakupniNaklady)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-500">Hrubá marže:</span>
                    <span className={`font-semibold ${hrubaMarze >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{fmtKc(hrubaMarze)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500 dark:text-slate-500">Marže %:</span>
                    <span className={`font-bold ${marzeProc >= 30 ? 'text-green-600 dark:text-green-400' : marzeProc >= 15 ? 'text-orange-600 dark:text-orange-400' : 'text-red-600 dark:text-red-400'}`}>
                      {marzeProc.toFixed(1)} %
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Poznámka */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-5 py-4 lg:col-span-1">
            <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Interní poznámka</h2>
            {canEdit ? (
              <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)} rows={4}
                placeholder="Interní poznámky k vyúčtování…"
                className="w-full border border-gray-300 dark:border-slate-600 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                style={{ fontSize: 16 }} />
            ) : (
              <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap min-h-[60px]">
                {poznamka || <span className="italic text-gray-400">Bez poznámky</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ─── Mobile sticky footer — above BottomNav ─── */}
      {stav === 'NAVRH' && (
        <div className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}>
          <div className="flex gap-3">
            <button
              onClick={() => { fetch(`/api/vyuctovani/${initial.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ poznamka }) }); setToast('Uloženo') }}
              disabled={loading}
              className="flex-1 bg-white/10 text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 min-h-[52px]"
            >
              Uložit
            </button>
            <button onClick={handleKeSchvaleni} disabled={loading}
              className="flex-1 bg-[#1B5E20] hover:bg-green-800 text-white rounded-xl py-3.5 font-medium text-sm disabled:opacity-50 min-h-[52px]">
              {loading ? '…' : 'Odeslat ke schválení'}
            </button>
          </div>
        </div>
      )}
      {stav === 'KE_SCHVALENI' && isAdmin && (
        <div className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}>
          <div className="flex gap-3">
            <button onClick={handleVratit} disabled={loading} className="flex-1 bg-white/10 text-white rounded-xl py-3.5 font-medium text-sm min-h-[52px]">Vrátit</button>
            <button onClick={() => setConfirmSchvalit(true)} disabled={loading} className="flex-1 bg-green-600 text-white rounded-xl py-3.5 font-medium text-sm min-h-[52px]">Schválit</button>
          </div>
        </div>
      )}
      {stav === 'SCHVALENO' && (
        <div className="fixed left-0 right-0 z-40 bg-[#0D1A0E] border-t border-green-900/50 md:hidden"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))', padding: '10px 16px' }}>
          <a href={`/api/vyuctovani/${initial.id}/pdf`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-white/10 text-white rounded-xl py-3.5 font-medium text-sm min-h-[52px]">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            Stáhnout PDF
          </a>
        </div>
      )}
    </>
  )
}
