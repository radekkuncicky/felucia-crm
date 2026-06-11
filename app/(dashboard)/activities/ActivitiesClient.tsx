'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import { ResizeHandle } from '@/components/ResizeHandle'
import ConfirmModal from '@/components/ConfirmModal'

const ACT_DEFS: ColumnDef[] = [
  { id: 'datum', label: 'Datum', defaultVisible: true, defaultWidth: 110 },
  { id: 'typ', label: 'Typ', defaultVisible: true, defaultWidth: 140 },
  { id: 'popis', label: 'Popis', defaultVisible: true, defaultWidth: 240 },
  { id: 'deal', label: 'Obchodní případ', defaultVisible: true, defaultWidth: 180 },
  { id: 'klient', label: 'Klient', defaultVisible: true, defaultWidth: 150 },
  { id: 'uzivatel', label: 'Uživatel', defaultVisible: true, defaultWidth: 120 },
]


const typOptions = [
  { value: '', label: 'Všechny typy' },
  { value: 'HOVOR', label: '📞 Hovor' },
  { value: 'EMAIL', label: '✉️ Email' },
  { value: 'SCHUZKA', label: '🤝 Schůzka' },
  { value: 'POZNAMKA', label: '📝 Poznámka' },
  { value: 'UKOL', label: '✅ Úkol' },
]

const typIcons: Record<string, string> = {
  HOVOR: '📞', EMAIL: '✉️', SCHUZKA: '🤝', POZNAMKA: '📝', UKOL: '✅',
}

const typLabels: Record<string, string> = {
  HOVOR: 'Hovor', EMAIL: 'Email', SCHUZKA: 'Schůzka', POZNAMKA: 'Poznámka', UKOL: 'Úkol',
}

const stavConfig = {
  PLANOVANA: { label: 'Plánovaná', dot: 'bg-gray-400', btn: 'bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 ring-gray-400' },
  DOKONCENA: { label: 'Dokončena', dot: 'bg-green-500', btn: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 ring-green-500' },
  ZRUSENA:   { label: 'Zrušena',   dot: 'bg-red-500',   btn: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 ring-red-500' },
} as const

type Stav = keyof typeof stavConfig

interface Activity {
  id: string
  typ: string
  popis: string | null
  datum: string
  splneno: boolean
  stav: Stav
  cil: string | null
  vysledek: string | null
  user: { id: string; jmeno: string } | null
  deal: {
    id: string
    predmet: string | null
    kod: string | null
    client: { id: string; jmeno: string; prijmeni: string }
  }
}

interface Props {
  activities: Activity[]
  defaultTyp?: string
}

const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary w-full'
const inpDisabled = 'w-full border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-gray-50 dark:bg-slate-800 text-gray-400 dark:text-slate-500 cursor-not-allowed'

function StavDot({ stav }: { stav: Stav }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${stavConfig[stav]?.dot ?? 'bg-gray-400'}`} />
}

function defaultFollowupDate(): string {
  const d = new Date()
  d.setDate(d.getDate() + 3)
  return d.toISOString().split('T')[0]
}

function ActivityModal({ act, onClose, onSaved, onDeleted }: {
  act: Activity
  onClose: () => void
  onSaved: (updated: Activity) => void
  onDeleted: (id: string) => void
}) {
  const [stav, setStav]     = useState<Stav>(act.stav)
  const [typ, setTyp]       = useState(act.typ)
  const [datum, setDatum]   = useState(act.datum)
  const [popis, setPopis]   = useState(act.popis ?? '')
  const [cil, setCil]       = useState(act.cil ?? '')
  const [vysledek, setVysledek] = useState(act.vysledek ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const [followupEnabled, setFollowupEnabled] = useState(false)
  const [followupDate, setFollowupDate] = useState(defaultFollowupDate)
  const [followupTyp, setFollowupTyp] = useState('HOVOR')
  const [followupPopis, setFollowupPopis] = useState('')

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch(`/api/activities/${act.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav, typ, datum, popis: popis || null, cil: cil || null, vysledek: vysledek || null }),
      })
      if (res.ok) {
        if (stav === 'DOKONCENA' && followupEnabled && followupPopis.trim()) {
          await fetch('/api/activities', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dealId: act.deal.id, typ: followupTyp, popis: followupPopis.trim(), datum: followupDate }),
          })
        }
        onSaved({ ...act, stav, typ, datum, popis: popis || null, cil: cil || null, vysledek: vysledek || null, splneno: stav === 'DOKONCENA' })
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteConfirm() {
    setConfirmDelete(false)
    setDeleting(true)
    try {
      const res = await fetch(`/api/activities/${act.id}`, { method: 'DELETE' })
      if (res.ok) { onDeleted(act.id); onClose() }
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
    <ConfirmModal isOpen={confirmDelete} title="Smazat aktivitu" message="Smazat tuto aktivitu?" confirmLabel="Smazat" danger loading={deleting} onConfirm={handleDeleteConfirm} onCancel={() => setConfirmDelete(false)} />
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-700 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{typIcons[typ] ?? '•'}</span>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">Upravit aktivitu</p>
              <Link href={`/deals/${act.deal.id}?tab=aktivity`} className="text-xs text-green-600 hover:underline" onClick={e => e.stopPropagation()}>
                {act.deal.kod ? `${act.deal.kod} · ` : ''}{act.deal.predmet ?? 'Bez předmětu'} — {act.deal.client.jmeno} {act.deal.client.prijmeni}
              </Link>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-white p-1 rounded">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Typ + Datum */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
              <select value={typ} onChange={e => setTyp(e.target.value)} className={inp}>
                <option value="HOVOR">📞 Hovor</option>
                <option value="EMAIL">✉️ Email</option>
                <option value="SCHUZKA">🤝 Schůzka</option>
                <option value="POZNAMKA">📝 Poznámka</option>
                <option value="UKOL">✅ Úkol</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
              <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inp} />
            </div>
          </div>

          {/* Stav switcher */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-2">Stav aktivity</label>
            <div className="flex gap-2">
              {(['PLANOVANA', 'DOKONCENA', 'ZRUSENA'] as Stav[]).map(s => (
                <button key={s} onClick={() => setStav(s)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${stav === s ? `ring-2 ${stavConfig[s].btn}` : 'bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                  <StavDot stav={s} />
                  {stavConfig[s].label}
                </button>
              ))}
            </div>
          </div>

          {/* Popis */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis / průběh</label>
            <textarea rows={2} value={popis} onChange={e => setPopis(e.target.value)} className={inp} placeholder="Volitelně — o čem to bude, co se plánuje…" />
          </div>

          {/* Cíl */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Cíl aktivity</label>
            <textarea rows={2} value={cil} onChange={e => setCil(e.target.value)} className={inp} placeholder="Co je cílem aktivity..." />
          </div>

          {/* Výsledek */}
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Výsledek</label>
            {stav === 'PLANOVANA' ? (
              <textarea rows={2} className={inpDisabled} disabled placeholder="Dostupné po změně stavu..." />
            ) : (
              <textarea rows={2} value={vysledek} onChange={e => setVysledek(e.target.value)} className={inp} placeholder="Co bylo výsledkem, na čem se dohodli..." />
            )}
          </div>

          {/* Follow-up */}
          {stav === 'DOKONCENA' && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-xl p-4 bg-blue-50 dark:bg-blue-950/30 space-y-3">
              <label className="flex items-center gap-2.5 cursor-pointer select-none">
                <input type="checkbox" checked={followupEnabled} onChange={e => setFollowupEnabled(e.target.checked)} className="w-4 h-4 accent-blue-600 flex-shrink-0" />
                <span className="text-sm font-medium text-blue-800 dark:text-blue-300">Naplánovat navazující aktivitu</span>
              </label>
              {followupEnabled && (
                <div className="space-y-2 pt-1">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
                      <select value={followupTyp} onChange={e => setFollowupTyp(e.target.value)} className={inp}>
                        <option value="HOVOR">📞 Hovor</option>
                        <option value="EMAIL">✉️ Email</option>
                        <option value="SCHUZKA">🤝 Schůzka</option>
                        <option value="UKOL">✅ Úkol</option>
                        <option value="POZNAMKA">📝 Poznámka</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum</label>
                      <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)} className={inp} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Popis</label>
                    <input type="text" value={followupPopis} onChange={e => setFollowupPopis(e.target.value)} className={inp} placeholder="Co je potřeba udělat..." />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-slate-700 flex items-center justify-between gap-3">
          <button onClick={() => setConfirmDelete(true)} disabled={deleting} className="text-sm text-red-500 hover:text-red-700 dark:hover:text-red-400 disabled:opacity-50">
            {deleting ? 'Mažu…' : 'Smazat'}
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-800">Zrušit</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-primary hover:bg-primary-hover rounded-lg disabled:opacity-50">
              {saving ? 'Ukládám…' : 'Uložit'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  )
}

export default function ActivitiesClient({ activities: initActivities, defaultTyp = '' }: Props) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns('activities', userId, ACT_DEFS)

  const [activities, setActivities] = useState(initActivities)
  const [typ, setTyp] = useState(defaultTyp)
  const [od, setOd] = useState('')
  const [do_, setDo] = useState('')
  const [stavFilter, setStavFilter] = useState('')
  const [selectedAct, setSelectedAct] = useState<Activity | null>(null)

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (typ && a.typ !== typ) return false
      if (od && a.datum < od) return false
      if (do_ && a.datum > do_) return false
      if (stavFilter && a.stav !== stavFilter) return false
      return true
    })
  }, [activities, typ, od, do_, stavFilter])

  const hasFilter = !!(typ || od || do_ || stavFilter)

  return (
    <div className="space-y-4">
      {selectedAct && (
        <ActivityModal
          act={selectedAct}
          onClose={() => setSelectedAct(null)}
          onSaved={updated => setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))}
          onDeleted={id => setActivities(prev => prev.filter(a => a.id !== id))}
        />
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 px-4 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Typ</label>
            <select value={typ} onChange={e => setTyp(e.target.value)} className={inp}>
              {typOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum od</label>
            <input type="date" value={od} onChange={e => setOd(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Datum do</label>
            <input type="date" value={do_} onChange={e => setDo(e.target.value)} className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1">Stav</label>
            <select value={stavFilter} onChange={e => setStavFilter(e.target.value)} className={inp}>
              <option value="">Všechny stavy</option>
              <option value="PLANOVANA">Plánovaná</option>
              <option value="DOKONCENA">Dokončena</option>
              <option value="ZRUSENA">Zrušena</option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between mt-3">
          {hasFilter ? (
            <button
              onClick={() => { setTyp(defaultTyp); setOd(''); setDo(''); setStavFilter('') }}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-white"
            >
              Zrušit filtry
            </button>
          ) : <span />}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500 dark:text-slate-400">{filtered.length} záznamů</span>
            <ColumnConfigButton
              columns={columns}
              defs={ACT_DEFS}
              onToggle={(id, vis) => updateColumn(id, { visible: vis })}
              onReorder={reorderColumns}
              onReset={resetColumns}
            />
          </div>
        </div>
      </div>

      {/* Mobile card layout */}
      <div className="sm:hidden bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
        {filtered.length === 0 && (
          <div className="px-4 py-10 text-center text-sm text-gray-400 dark:text-slate-500">Žádné aktivity</div>
        )}
        {filtered.map(act => (
          <div key={act.id} onClick={() => setSelectedAct(act)} className={`p-4 space-y-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 ${act.stav === 'DOKONCENA' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-lg">{typIcons[act.typ] ?? '•'}</span>
                <div>
                  <div className="flex items-center gap-1.5">
                    <StavDot stav={act.stav} />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{typLabels[act.typ] ?? act.typ}</span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                {new Date(act.datum + 'T00:00:00').toLocaleDateString('cs-CZ')}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-slate-200 line-clamp-2">{act.popis ?? <span className="text-gray-400 italic">bez popisu</span>}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link href={`/deals/${act.deal.id}?tab=aktivity`} className="text-green-600 dark:text-green-400 hover:underline" onClick={e => e.stopPropagation()}>
                {act.deal.kod && <span className="font-mono text-gray-400 mr-1">{act.deal.kod}</span>}
                {act.deal.predmet ?? 'Bez předmětu'}
              </Link>
              <Link href={`/clients/${act.deal.client.id}`} className="text-gray-500 dark:text-slate-400 hover:text-green-600" onClick={e => e.stopPropagation()}>
                {act.deal.client.jmeno} {act.deal.client.prijmeni}
              </Link>
              {act.user && <span className="text-gray-400 dark:text-slate-500">{act.user.jmeno}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" style={{ tableLayout: 'fixed', minWidth: 500 }}>
            <colgroup>
              {visibleColumns.map(col => (
                <col key={col.id} style={{ width: col.width ?? undefined }} />
              ))}
            </colgroup>
            <thead className="bg-gray-50 dark:bg-slate-900">
              <tr>
                {visibleColumns.map(col => (
                  <th key={col.id} className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 relative select-none">
                    {ACT_DEFS.find(d => d.id === col.id)?.label}
                    <ResizeHandle onResize={dx => resizeColumn(col.id, dx)} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-slate-500">
                    Žádné aktivity
                  </td>
                </tr>
              )}
              {filtered.map(act => (
                <tr
                  key={act.id}
                  onClick={() => setSelectedAct(act)}
                  className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${act.stav === 'DOKONCENA' ? 'opacity-60' : ''}`}
                >
                  {visibleColumns.map(col => {
                    switch (col.id) {
                      case 'datum':
                        return (
                          <td key={col.id} className="px-4 py-3 text-sm text-gray-700 dark:text-slate-300 whitespace-nowrap overflow-hidden">
                            {new Date(act.datum + 'T00:00:00').toLocaleDateString('cs-CZ')}
                          </td>
                        )
                      case 'typ':
                        return (
                          <td key={col.id} className="px-4 py-3 overflow-hidden">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                              <StavDot stav={act.stav} />
                              <span>{typIcons[act.typ] ?? '•'}</span>
                              <span className="truncate">{typLabels[act.typ] ?? act.typ}</span>
                            </span>
                          </td>
                        )
                      case 'popis':
                        return (
                          <td key={col.id} className="px-4 py-3 text-sm text-gray-800 dark:text-slate-200 overflow-hidden">
                            <span className="line-clamp-2">{act.popis ?? <span className="text-gray-400 italic">bez popisu</span>}</span>
                          </td>
                        )
                      case 'deal':
                        return (
                          <td key={col.id} className="px-4 py-3 overflow-hidden">
                            <Link
                              href={`/deals/${act.deal.id}?tab=aktivity`}
                              className="text-sm text-green-600 dark:text-green-400 hover:underline truncate block"
                              onClick={e => e.stopPropagation()}
                            >
                              {act.deal.kod && (
                                <span className="font-mono text-xs text-gray-400 dark:text-slate-500 mr-1">{act.deal.kod}</span>
                              )}
                              {act.deal.predmet ?? 'Bez předmětu'}
                            </Link>
                          </td>
                        )
                      case 'klient':
                        return (
                          <td key={col.id} className="px-4 py-3 overflow-hidden">
                            <Link
                              href={`/clients/${act.deal.client.id}`}
                              className="text-sm text-gray-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 truncate block"
                              onClick={e => e.stopPropagation()}
                            >
                              {act.deal.client.jmeno} {act.deal.client.prijmeni}
                            </Link>
                          </td>
                        )
                      case 'uzivatel':
                        return (
                          <td key={col.id} className="px-4 py-3 text-sm text-gray-500 dark:text-slate-400 overflow-hidden">
                            <span className="truncate block">{act.user?.jmeno ?? '—'}</span>
                          </td>
                        )
                      default:
                        return <td key={col.id} />
                    }
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
