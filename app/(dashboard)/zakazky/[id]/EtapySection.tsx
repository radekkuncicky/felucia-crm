'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { EtapaStav } from '@prisma/client'
import { api } from '@/lib/api'

interface EtapaPredavak { id: string; cislo: string; stav: string }
interface EtapaVyuctovani { id: string; cislo: string; stav: string }

interface Etapa {
  id: string
  cislo: number
  nazev: string | null
  montazOd: string | null
  montazDo: string | null
  stav: EtapaStav
  poznamka: string | null
  predavaky: EtapaPredavak[]
  vyuctovani: EtapaVyuctovani[]
}

interface Props {
  zakazkaId: string
  etapy: Etapa[]
  canEdit: boolean
  zakazkaStav: string
}

const STAV_LABELS: Record<EtapaStav, string> = {
  PLANOVANA: 'Plánována',
  PROBIHAJICI: 'Probíhá',
  PREDANA: 'Předána',
}
const STAV_COLORS: Record<EtapaStav, string> = {
  PLANOVANA: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  PROBIHAJICI: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  PREDANA: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}
const PP_STAV_COLORS: Record<string, string> = {
  ROZPRACOVAN: 'text-gray-500',
  PODPISAN: 'text-blue-600',
  SCHVALEN: 'text-green-600',
  ODMITNUTO: 'text-red-500',
}
const VYU_STAV_COLORS: Record<string, string> = {
  NAVRH: 'text-gray-500',
  KE_SCHVALENI: 'text-yellow-600',
  SCHVALENO: 'text-green-600',
}

function formatDate(iso: string | null) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

export default function EtapySection({ zakazkaId, etapy: initialEtapy, canEdit, zakazkaStav }: Props) {
  const router = useRouter()
  const [etapy, setEtapy] = useState<Etapa[]>(initialEtapy)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)

  const showSection = etapy.length > 0 || ['V_REALIZACI', 'PREDANA', 'VYUCTOVANA', 'HOTOVO'].includes(zakazkaStav)

  if (!showSection) return null

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Etapy montáže</h3>
          {etapy.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-slate-500">
              {etapy.filter(e => e.stav === 'PREDANA').length}/{etapy.length} předáno
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowAddForm(v => !v)}
            className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-400 hover:text-green-800 dark:hover:text-green-300 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Přidat etapu
          </button>
        )}
      </div>

      {etapy.length === 0 && !showAddForm && (
        <div className="px-5 py-6 text-center">
          <p className="text-sm text-gray-400 dark:text-slate-500">Žádné etapy. Zakázka probíhá jako jednofázová montáž.</p>
          {canEdit && (
            <button
              onClick={() => setShowAddForm(true)}
              className="mt-3 text-sm font-medium text-green-700 dark:text-green-400 hover:underline"
            >
              + Rozdělit na etapy
            </button>
          )}
        </div>
      )}

      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {etapy.map(e => (
          <EtapaRow
            key={e.id}
            etapa={e}
            zakazkaId={zakazkaId}
            canEdit={canEdit}
            isExpanded={expandedId === e.id}
            isEditing={editingId === e.id}
            onToggle={() => setExpandedId(prev => prev === e.id ? null : e.id)}
            onEditStart={() => { setEditingId(e.id); setExpandedId(e.id) }}
            onEditCancel={() => setEditingId(null)}
            onUpdate={updated => {
              setEtapy(prev => prev.map(x => x.id === updated.id ? updated : x))
              setEditingId(null)
            }}
            onDelete={() => {
              setEtapy(prev => prev.filter(x => x.id !== e.id))
              if (expandedId === e.id) setExpandedId(null)
              router.refresh()
            }}
          />
        ))}
      </div>

      {showAddForm && canEdit && (
        <AddEtapaForm
          zakazkaId={zakazkaId}
          onSave={newEtapa => {
            setEtapy(prev => [...prev, newEtapa])
            setShowAddForm(false)
            setExpandedId(newEtapa.id)
            router.refresh()
          }}
          onCancel={() => setShowAddForm(false)}
        />
      )}
    </div>
  )
}

function EtapaRow({
  etapa, zakazkaId, canEdit, isExpanded, isEditing,
  onToggle, onEditStart, onEditCancel, onUpdate, onDelete,
}: {
  etapa: Etapa
  zakazkaId: string
  canEdit: boolean
  isExpanded: boolean
  isEditing: boolean
  onToggle: () => void
  onEditStart: () => void
  onEditCancel: () => void
  onUpdate: (e: Etapa) => void
  onDelete: () => void
}) {
  const od = formatDate(etapa.montazOd)
  const do_ = formatDate(etapa.montazDo)
  const termín = od && do_ ? `${od} – ${do_}` : od ? `Od ${od}` : do_ ? `Do ${do_}` : null

  return (
    <div>
      <div
        className="px-5 py-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            etapa.stav === 'PREDANA' ? 'bg-green-500 text-white' :
            etapa.stav === 'PROBIHAJICI' ? 'bg-blue-500 text-white' :
            'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-slate-300'
          }`}>
            {etapa.stav === 'PREDANA' ? '✓' : etapa.cislo}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-gray-900 dark:text-white text-sm">
                Etapa {etapa.cislo}{etapa.nazev ? ` — ${etapa.nazev}` : ''}
              </span>
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[etapa.stav]}`}>
                {STAV_LABELS[etapa.stav]}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              {termín && <span className="text-xs text-gray-500 dark:text-slate-400">{termín}</span>}
              <span className="text-xs text-gray-400 dark:text-slate-500">
                {etapa.predavaky.length} protokol{etapa.predavaky.length === 1 ? '' : 'y/ů'}
                {' · '}
                {etapa.vyuctovani.length} vyúčtování
              </span>
            </div>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isExpanded && (
        <div className="px-5 pb-4 space-y-4 border-t border-gray-50 dark:border-slate-700/50 pt-3">
          {isEditing ? (
            <EditEtapaForm
              etapa={etapa}
              zakazkaId={zakazkaId}
              onSave={onUpdate}
              onCancel={onEditCancel}
              onDelete={onDelete}
              canDelete={canEdit && etapa.predavaky.length === 0 && etapa.vyuctovani.length === 0}
            />
          ) : (
            <>
              {etapa.poznamka && (
                <p className="text-sm text-gray-600 dark:text-slate-400 italic">{etapa.poznamka}</p>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Protokoly</p>
                    {canEdit && (
                      <Link
                        href={`/zakazky/${zakazkaId}?tab=predavaky`}
                        className="text-xs text-primary dark:text-primary-light hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        + Nový
                      </Link>
                    )}
                  </div>
                  {etapa.predavaky.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 italic">Žádné protokoly</p>
                  ) : (
                    <div className="space-y-1">
                      {etapa.predavaky.map(pp => (
                        <div key={pp.id} className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-medium ${PP_STAV_COLORS[pp.stav] ?? 'text-gray-600'}`}>
                            {pp.cislo}
                          </span>
                          <Link
                            href={`/zakazky/${zakazkaId}/predavaky/${pp.id}`}
                            className="text-xs text-primary dark:text-primary-light hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            Detail
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Vyúčtování</p>
                    {canEdit && (
                      <Link
                        href={`/zakazky/${zakazkaId}/vyuctovani/nove?etapaId=${etapa.id}`}
                        className="text-xs text-primary dark:text-primary-light hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        + Nové
                      </Link>
                    )}
                  </div>
                  {etapa.vyuctovani.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-slate-500 italic">Žádné vyúčtování</p>
                  ) : (
                    <div className="space-y-1">
                      {etapa.vyuctovani.map(v => (
                        <div key={v.id} className="flex items-center justify-between">
                          <span className={`text-xs font-mono font-medium ${VYU_STAV_COLORS[v.stav] ?? 'text-gray-600'}`}>
                            {v.cislo}
                          </span>
                          <Link
                            href={`/zakazky/${zakazkaId}/vyuctovani/${v.id}`}
                            className="text-xs text-primary dark:text-primary-light hover:underline"
                            onClick={e => e.stopPropagation()}
                          >
                            Detail
                          </Link>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {canEdit && (
                <button
                  onClick={e => { e.stopPropagation(); onEditStart() }}
                  className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-300 underline"
                >
                  Upravit etapu
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function EditEtapaForm({
  etapa, zakazkaId, onSave, onCancel, onDelete, canDelete,
}: {
  etapa: Etapa
  zakazkaId: string
  onSave: (e: Etapa) => void
  onCancel: () => void
  onDelete: () => void
  canDelete: boolean
}) {
  const [nazev, setNazev] = useState(etapa.nazev ?? '')
  const [montazOd, setMontazOd] = useState(etapa.montazOd ? etapa.montazOd.slice(0, 10) : '')
  const [montazDo, setMontazDo] = useState(etapa.montazDo ? etapa.montazDo.slice(0, 10) : '')
  const [stav, setStav] = useState<EtapaStav>(etapa.stav)
  const [poznamka, setPoznamka] = useState(etapa.poznamka ?? '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.patch<Etapa>(`/api/zakazky/${zakazkaId}/etapy/${etapa.id}`,
        { nazev, montazOd: montazOd || null, montazDo: montazDo || null, stav, poznamka },
      )
      if (res.ok && res.data) onSave(res.data)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      const res = await api.delete(`/api/zakazky/${zakazkaId}/etapy/${etapa.id}`)
      if (res.ok) onDelete()
      else setConfirmDelete(false)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-3" onClick={e => e.stopPropagation()}>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Název etapy</label>
          <input
            value={nazev}
            onChange={e => setNazev(e.target.value)}
            placeholder="např. Hrubá montáž"
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Stav</label>
          <select
            value={stav}
            onChange={e => setStav(e.target.value as EtapaStav)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="PLANOVANA">Plánována</option>
            <option value="PROBIHAJICI">Probíhá</option>
            <option value="PREDANA">Předána</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Termín od</label>
          <input type="date" value={montazOd} onChange={e => setMontazOd(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Termín do</label>
          <input type="date" value={montazDo} onChange={e => setMontazDo(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Poznámka</label>
        <input value={poznamka} onChange={e => setPoznamka(e.target.value)} placeholder="Volitelná poznámka…"
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {canDelete && !confirmDelete && (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-500 hover:text-red-700 dark:text-red-400">
            Smazat etapu
          </button>
        )}
        {confirmDelete && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 dark:text-red-400">Opravdu smazat?</span>
            <button onClick={handleDelete} disabled={deleting} className="text-xs font-medium text-white bg-red-600 px-2 py-1 rounded disabled:opacity-50">
              {deleting ? '…' : 'Smazat'}
            </button>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500">Zrušit</button>
          </div>
        )}
        {!confirmDelete && <div />}
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg">
            Zrušit
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-xs font-medium text-white bg-green-600 hover:bg-green-700 px-3 py-1.5 rounded-lg disabled:opacity-50">
            {saving ? 'Ukládám…' : 'Uložit'}
          </button>
        </div>
      </div>
    </div>
  )
}

function AddEtapaForm({ zakazkaId, onSave, onCancel }: {
  zakazkaId: string
  onSave: (e: Etapa) => void
  onCancel: () => void
}) {
  const [nazev, setNazev] = useState('')
  const [montazOd, setMontazOd] = useState('')
  const [montazDo, setMontazDo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    setSaving(true)
    try {
      const res = await api.post<Etapa>(`/api/zakazky/${zakazkaId}/etapy`,
        { nazev, montazOd: montazOd || null, montazDo: montazDo || null },
      )
      if (res.ok && res.data) onSave(res.data)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="px-5 py-4 border-t border-gray-100 dark:border-slate-700 bg-gray-50/50 dark:bg-slate-700/20 space-y-3">
      <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Nová etapa</p>
      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Název (volitelný)</label>
          <input
            value={nazev}
            onChange={e => setNazev(e.target.value)}
            placeholder="např. Zprovoznění"
            autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') onCancel() }}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Termín od</label>
          <input type="date" value={montazOd} onChange={e => setMontazOd(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Termín do</label>
          <input type="date" value={montazDo} onChange={e => setMontazDo(e.target.value)}
            className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-1.5 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500" />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="text-sm text-gray-500 dark:text-slate-400 px-3 py-1.5 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
          Zrušit
        </button>
        <button onClick={handleSave} disabled={saving}
          className="text-sm font-medium text-white bg-green-600 hover:bg-green-700 px-4 py-1.5 rounded-lg disabled:opacity-50">
          {saving ? 'Přidávám…' : 'Přidat etapu'}
        </button>
      </div>
    </div>
  )
}
