'use client'

import EmptyState from '@/components/ui/EmptyState'
import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import { ResizeHandle } from '@/components/ResizeHandle'
import ConfirmModal from '@/components/ConfirmModal'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input, Select, Textarea } from '@/components/ui/Field'
import { formatDate } from '@/lib/format'
import { ActivityTypeIcon } from '@/components/ui/ActivityTypeIcon'
import FilterDropdown from '@/components/ui/FilterDropdown'
import ListToolbar from '@/components/ui/ListToolbar'
import ShowMore from '@/components/ui/ShowMore'
import { useUrlFilters } from '@/hooks/useUrlFilters'
import { useShowMore } from '@/hooks/useShowMore'
import DokoncitAktivituModal from '@/components/DokoncitAktivituModal'

const ACT_DEFS: ColumnDef[] = [
  { id: 'datum', label: 'Datum', defaultVisible: true, defaultWidth: 110 },
  { id: 'typ', label: 'Typ', defaultVisible: true, defaultWidth: 140 },
  { id: 'popis', label: 'Popis', defaultVisible: true, defaultWidth: 240 },
  { id: 'deal', label: 'Obchodní případ / lead', defaultVisible: true, defaultWidth: 180 },
  { id: 'klient', label: 'Klient', defaultVisible: true, defaultWidth: 150 },
  { id: 'uzivatel', label: 'Uživatel', defaultVisible: true, defaultWidth: 120 },
]


const typOptions = [
  { value: '', label: 'Všechny typy' },
  { value: 'HOVOR', label: 'Hovor' },
  { value: 'EMAIL', label: 'Email' },
  { value: 'SCHUZKA', label: 'Schůzka' },
  { value: 'POZNAMKA', label: 'Poznámka' },
  { value: 'UKOL', label: 'Úkol' },
]

const typLabels: Record<string, string> = {
  HOVOR: 'Hovor', EMAIL: 'Email', SCHUZKA: 'Schůzka', POZNAMKA: 'Poznámka', UKOL: 'Úkol',
}

const stavFilterOptions = [
  { value: '', label: 'Všechny stavy' },
  { value: 'PLANOVANA', label: 'Plánovaná' },
  { value: 'DOKONCENA', label: 'Dokončena' },
  { value: 'ZRUSENA', label: 'Zrušena' },
]

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
  } | null
  lead: { id: string; jmeno: string; firma: string | null } | null
}

interface Props {
  activities: Activity[]
  defaultTyp?: string
}

const inp = 'border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary w-full'

function StavDot({ stav }: { stav: Stav }) {
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${stavConfig[stav]?.dot ?? 'bg-gray-400'}`} />
}

/** Odkaz na rodiče aktivity — OP (tab aktivit) nebo lead */
function parentHref(act: Activity): string {
  return act.deal ? `/deals/${act.deal.id}?tab=aktivity` : act.lead ? `/leady/${act.lead.id}` : '/activities'
}

function ParentLabel({ act, mono = 'text-gray-400' }: { act: Activity; mono?: string }) {
  if (act.deal) return <>{act.deal.kod && <span className={`font-mono text-xs ${mono} mr-1`}>{act.deal.kod}</span>}{act.deal.predmet ?? 'Bez předmětu'}</>
  if (act.lead) return <><span className={`text-xs ${mono} mr-1`}>Lead</span>{act.lead.jmeno}</>
  return <>—</>
}

function KlientLink({ act, className }: { act: Activity; className: string }) {
  if (act.deal) {
    return (
      <Link href={`/clients/${act.deal.client.id}`} className={className} onClick={e => e.stopPropagation()}>
        {act.deal.client.jmeno} {act.deal.client.prijmeni}
      </Link>
    )
  }
  if (act.lead) {
    return (
      <Link href={`/leady/${act.lead.id}`} className={className} onClick={e => e.stopPropagation()}>
        {act.lead.firma || act.lead.jmeno}
      </Link>
    )
  }
  return <span className={className}>—</span>
}

function ActivityModal({ act, onClose, onSaved, onDeleted, onFollowUp }: {
  act: Activity
  onClose: () => void
  onSaved: (updated: Activity) => void
  onDeleted: (id: string) => void
  onFollowUp: (a: Activity) => void
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

  const [dokoncit, setDokoncit] = useState(false)
  const [error, setError] = useState('')
  const typy = act.lead ? typOptions.filter(t => t.value === 'HOVOR' || t.value === 'EMAIL') : typOptions.filter(t => t.value)

  async function handleSave() {
    // Přechod na Dokončena → dialog s nabídkou navazující aktivity (uloží i ostatní pole)
    if (stav === 'DOKONCENA' && act.stav !== 'DOKONCENA') { setDokoncit(true); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/activities/${act.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav, typ, datum, popis: popis || null, cil: cil || null, vysledek: vysledek || null }),
      })
      if (!res.ok) { setError((await res.json().catch(() => null))?.error ?? 'Nepodařilo se uložit aktivitu'); return }
      onSaved({ ...act, stav, typ, datum, popis: popis || null, cil: cil || null, vysledek: vysledek || null, splneno: stav === 'DOKONCENA' })
      onClose()
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
    {dokoncit && (
      <DokoncitAktivituModal
        act={{ id: act.id, typ, popis: popis || null, vysledek }}
        patchUrl={`/api/activities/${act.id}`}
        jeLead={!!act.lead}
        extraPatch={{ typ, datum, popis: popis || null, cil: cil || null }}
        onClose={() => setDokoncit(false)}
        onDone={({ activity, followUp }) => {
          onSaved({ ...act, typ, datum, popis: popis || null, cil: cil || null, stav: 'DOKONCENA', splneno: true, vysledek: (activity.vysledek as string | null) ?? null })
          if (followUp) {
            onFollowUp({
              ...act,
              id: followUp.id,
              typ: followUp.typ,
              popis: followUp.popis,
              datum: new Date(followUp.datum).toISOString().split('T')[0],
              stav: 'PLANOVANA',
              splneno: false,
              cil: null,
              vysledek: null,
            })
          }
          onClose()
        }}
      />
    )}
    <Dialog
      open
      // Esc / klik mimo nezavře editaci, dokud je nad ní dialog dokončení
      onClose={() => { if (!dokoncit) onClose() }}
      size="lg"
      ariaLabel="Upravit aktivitu"
      title={
        <div className="flex items-center gap-3">
          <ActivityTypeIcon typ={typ} className="w-6 h-6" />
          <div>
            <p className="font-semibold text-gray-900 dark:text-white">Upravit aktivitu</p>
            <Link href={parentHref(act)} className="text-xs font-normal text-green-600 hover:underline">
              {act.deal
                ? <>{act.deal.kod ? `${act.deal.kod} · ` : ''}{act.deal.predmet ?? 'Bez předmětu'} — {act.deal.client.jmeno} {act.deal.client.prijmeni}</>
                : <>Lead — {act.lead?.jmeno}{act.lead?.firma ? ` (${act.lead.firma})` : ''}</>}
            </Link>
          </div>
        </div>
      }
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <Button variant="ghost" className="text-red-600 dark:text-red-400" onClick={() => setConfirmDelete(true)} loading={deleting}>Smazat</Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>Zrušit</Button>
            <Button onClick={handleSave} loading={saving}>Uložit</Button>
          </div>
        </div>
      }
    >
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Typ">
              <Select value={typ} onChange={e => setTyp(e.target.value)}>
                {typy.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </Select>
            </Field>
            <Field label="Datum">
              <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
            </Field>
          </div>

          <div role="group" aria-label="Stav aktivity">
            <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Stav aktivity</p>
            <div className="flex gap-2">
              {(['PLANOVANA', 'DOKONCENA', 'ZRUSENA'] as Stav[]).map(s => (
                <button key={s} type="button" aria-pressed={stav === s} onClick={() => setStav(s)}
                  className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${stav === s ? `ring-2 ${stavConfig[s].btn}` : 'bg-gray-50 dark:bg-slate-700/50 text-gray-500 dark:text-slate-400 hover:bg-gray-100 dark:hover:bg-slate-700'}`}>
                  <StavDot stav={s} />
                  {stavConfig[s].label}
                </button>
              ))}
            </div>
          </div>

          <Field label="Popis / průběh">
            <Textarea rows={2} value={popis} onChange={e => setPopis(e.target.value)} placeholder="Volitelně — o čem to bude, co se plánuje…" />
          </Field>
          <Field label="Cíl aktivity">
            <Textarea rows={2} value={cil} onChange={e => setCil(e.target.value)} placeholder="Co je cílem aktivity..." />
          </Field>
          <Field label="Výsledek" hint={stav === 'PLANOVANA' ? 'Dostupné po změně stavu' : undefined}>
            <Textarea rows={2} value={stav === 'PLANOVANA' ? '' : vysledek} disabled={stav === 'PLANOVANA'} onChange={e => setVysledek(e.target.value)} placeholder="Co bylo výsledkem, na čem se dohodli..." />
          </Field>

          {stav === 'DOKONCENA' && act.stav !== 'DOKONCENA' && (
            <p className="text-xs text-blue-700 dark:text-blue-300">Po uložení můžete rovnou naplánovat navazující aktivitu.</p>
          )}
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>
    </Dialog>
    </>
  )
}

export default function ActivitiesClient({ activities: initActivities, defaultTyp = '' }: Props) {
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns('activities', userId, ACT_DEFS)

  const [activities, setActivities] = useState(initActivities)
  // ?typ= z odkazu (např. menu Úkoly) přebírá i server; ostatní filtry jen klient
  const { values: f, set, reset, activeCount } = useUrlFilters({ q: '', typ: defaultTyp, od: '', do: '', stav: '' })
  const { q: search, typ, od, do: do_, stav: stavFilter } = f
  const [selectedAct, setSelectedAct] = useState<Activity | null>(null)

  const filtered = useMemo(() => {
    return activities.filter(a => {
      if (typ && a.typ !== typ) return false
      if (od && a.datum < od) return false
      if (do_ && a.datum > do_) return false
      if (stavFilter && a.stav !== stavFilter) return false
      if (search) {
        const q = search.toLowerCase()
        const hay = [
          a.popis, a.deal?.kod, a.deal?.predmet, a.deal?.client.jmeno, a.deal?.client.prijmeni,
          a.lead?.jmeno, a.lead?.firma, a.user?.jmeno,
        ].filter(Boolean).join(' ').toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [activities, typ, od, do_, stavFilter, search])
  const more = useShowMore(filtered, f)

  return (
    <div className="space-y-4">
      {selectedAct && (
        <ActivityModal
          act={selectedAct}
          onClose={() => setSelectedAct(null)}
          onSaved={updated => setActivities(prev => prev.map(a => a.id === updated.id ? updated : a))}
          onDeleted={id => setActivities(prev => prev.filter(a => a.id !== id))}
          onFollowUp={a => setActivities(prev => [a, ...prev])}
        />
      )}

      <ListToolbar
        search={search}
        onSearch={v => set('q', v)}
        searchPlaceholder="Hledat (popis, případ, klient)…"
        activeCount={activeCount(['q'])}
        onReset={() => reset()}
        trailing={
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
        }
      >
        <FilterDropdown value={typ} onChange={v => set('typ', v)} options={typOptions} />
        <FilterDropdown value={stavFilter} onChange={v => set('stav', v)} options={stavFilterOptions} />
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          Od
          <input type="date" value={od} onChange={e => set('od', e.target.value)} className={inp} />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400">
          Do
          <input type="date" value={do_} onChange={e => set('do', e.target.value)} className={inp} />
        </label>
      </ListToolbar>

      {/* Mobile card layout */}
      <div className="sm:hidden bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
        {filtered.length === 0 && (activities.length === 0 ? (
          <EmptyState compact title="Zatím žádné aktivity" description="Hovory, schůzky a úkoly zapisujete na obchodním případu nebo leadu." actionLabel="Obchodní případy" actionHref="/deals" />
        ) : (
          <EmptyState compact title="Nic neodpovídá filtru" actionLabel="Zrušit filtry" onAction={() => reset()} />
        ))}
        {more.visible.map(act => (
          <div key={act.id} onClick={() => setSelectedAct(act)} className={`p-4 space-y-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/50 ${act.stav === 'DOKONCENA' ? 'opacity-60' : ''}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2">
                <ActivityTypeIcon typ={act.typ} className="w-5 h-5" />
                <div>
                  <div className="flex items-center gap-1.5">
                    <StavDot stav={act.stav} />
                    <span className="text-sm font-medium text-gray-700 dark:text-slate-300">{typLabels[act.typ] ?? act.typ}</span>
                  </div>
                </div>
              </div>
              <span className="text-xs text-gray-400 dark:text-slate-500 whitespace-nowrap flex-shrink-0">
                {formatDate(act.datum + 'T00:00:00')}
              </span>
            </div>
            <p className="text-sm text-gray-800 dark:text-slate-200 line-clamp-2">{act.popis ?? <span className="text-gray-400 italic">bez popisu</span>}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
              <Link href={parentHref(act)} className="text-green-600 dark:text-green-400 hover:underline" onClick={e => e.stopPropagation()}>
                <ParentLabel act={act} />
              </Link>
              <KlientLink act={act} className="text-gray-500 dark:text-slate-400 hover:text-green-600" />
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
                  <td colSpan={visibleColumns.length}>
                    {(activities.length === 0 ? (
          <EmptyState compact title="Zatím žádné aktivity" description="Hovory, schůzky a úkoly zapisujete na obchodním případu nebo leadu." actionLabel="Obchodní případy" actionHref="/deals" />
        ) : (
          <EmptyState compact title="Nic neodpovídá filtru" actionLabel="Zrušit filtry" onAction={() => reset()} />
        ))}
                  </td>
                </tr>
              )}
              {more.visible.map(act => (
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
                            {formatDate(act.datum + 'T00:00:00')}
                          </td>
                        )
                      case 'typ':
                        return (
                          <td key={col.id} className="px-4 py-3 overflow-hidden">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-700 dark:text-slate-300">
                              <StavDot stav={act.stav} />
                              <ActivityTypeIcon typ={act.typ} />
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
                              href={parentHref(act)}
                              className="text-sm text-green-600 dark:text-green-400 hover:underline truncate block"
                              onClick={e => e.stopPropagation()}
                            >
                              <ParentLabel act={act} mono="text-gray-400 dark:text-slate-500" />
                            </Link>
                          </td>
                        )
                      case 'klient':
                        return (
                          <td key={col.id} className="px-4 py-3 overflow-hidden">
                            <KlientLink act={act} className="text-sm text-gray-700 dark:text-slate-300 hover:text-green-600 dark:hover:text-green-400 truncate block" />
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
      <ShowMore remaining={more.remaining} total={more.total} step={more.step} onClick={more.showMore} />
    </div>
  )
}
