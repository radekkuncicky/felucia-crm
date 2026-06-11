'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavigateButton } from '@/components/NavigateButton'

type ServisStav = 'PLANOVANA' | 'POTVRZENA' | 'PROBIHA' | 'DOKONCENA' | 'ZRUSENA' | 'PRESLA'
type NavstevaTyp = 'PLANOVANY_SERVIS' | 'PORUCHA' | 'ZARUCNI_OPRAVA' | 'POZARUCNI_OPRAVA' | 'UVEDENI_DO_PROVOZU' | 'KONTROLA'
type ZarizeniTyp = 'TEPELNE_CERPADLO' | 'KLIMATIZACE' | 'REKUPERACE' | 'PODLAHOVE_VYTAPENI' | 'VZDUCHOTECHNIKA' | 'OHREV_TV' | 'JINE'

interface Zarizeni {
  id: string
  nazev: string
  typ: ZarizeniTyp
}

interface Navsteva {
  id: string
  cisloNavstevy: string | null
  typ: NavstevaTyp
  planovanyTermin: string
  skutecnyTermin: string | null
  stav: ServisStav
  technikId: string | null
  poznamka: string | null
  kontrakt: {
    id: string
    nazev: string
    dealId: string | null
    klient: { id: string; jmeno: string; prijmeni: string; ulice: string | null; mesto: string | null; psc: string | null }
  } | null
  zarizeni: Zarizeni | null
  technik: { id: string; jmeno: string } | null
}

interface ZarizeniListItem {
  id: string
  nazev: string
  typ: ZarizeniTyp
  klient: { id: string; jmeno: string; prijmeni: string }
  kontraktyId: string | null
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  navstevy: Navsteva[]
  orgUsers: OrgUser[]
  zarizeniList: ZarizeniListItem[]
}

const navstevaTypLabels: Record<NavstevaTyp, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

const stavColors: Record<ServisStav, string> = {
  PLANOVANA: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  POTVRZENA: 'bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300',
  PROBIHA: 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300',
  DOKONCENA: 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300',
  ZRUSENA: 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300',
  PRESLA: 'bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300',
}

const stavLabels: Record<ServisStav, string> = {
  PLANOVANA: 'Plánovaná',
  POTVRZENA: 'Potvrzená',
  PROBIHA: 'Probíhá',
  DOKONCENA: 'Dokončená',
  ZRUSENA: 'Zrušená',
  PRESLA: 'Prošlá',
}

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500', 'bg-teal-500']

function technikColor(technikId: string | null, users: OrgUser[]) {
  if (!technikId) return 'bg-gray-400'
  const idx = users.findIndex(u => u.id === technikId)
  return COLORS[idx % COLORS.length]
}

// Get ISO week number
function getWeekKey(d: Date) {
  const tmp = new Date(d)
  tmp.setHours(0, 0, 0, 0)
  tmp.setDate(tmp.getDate() + 4 - (tmp.getDay() || 7))
  const yearStart = new Date(tmp.getFullYear(), 0, 1)
  const weekNo = Math.ceil((((tmp.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  return `${tmp.getFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function getWeekStart(weekKey: string) {
  const [year, w] = weekKey.split('-W').map(Number)
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const weekStart = new Date(jan4)
  weekStart.setDate(jan4.getDate() - dayOfWeek + 1 + (w - 1) * 7)
  return weekStart
}

function weekLabel(weekKey: string) {
  const now = new Date()
  const thisWeek = getWeekKey(now)
  const nextWeek = getWeekKey(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000))
  if (weekKey === thisWeek) return 'Tento týden'
  if (weekKey === nextWeek) return 'Příští týden'
  const start = getWeekStart(weekKey)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  return `${start.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', year: 'numeric' })}`
}

function groupByWeek(navstevy: Navsteva[]) {
  const groups: Record<string, Navsteva[]> = {}
  for (const n of navstevy) {
    const key = getWeekKey(new Date(n.planovanyTermin))
    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  }
  return groups
}

// Simple calendar: returns days in month with their navstevy
function getDaysInMonth(year: number, month: number) {
  const days = []
  const d = new Date(year, month, 1)
  while (d.getMonth() === month) {
    days.push(new Date(d))
    d.setDate(d.getDate() + 1)
  }
  return days
}

const emptyForm = {
  zarizeniId: '',
  zarizeniSearch: '',
  klientId: '',
  kontraktId: '',
  planovanyTermin: '',
  cas: '09:00',
  trvaniMinut: '60',
  typ: 'PLANOVANY_SERVIS' as NavstevaTyp,
  technikId: '',
  poznamka: '',
}

export default function PlanClient({ navstevy, orgUsers, zarizeniList }: Props) {
  const router = useRouter()
  const [view, setView] = useState<'seznam' | 'mesic'>('seznam')
  const [saving, setSaving] = useState(false)
  const [novaNavstevaOpen, setNovaNavstevaOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [calDate, setCalDate] = useState(new Date())

  const today = new Date()

  const filteredZarizeni = zarizeniList.filter(z =>
    !form.zarizeniSearch || `${z.nazev} ${z.klient.jmeno} ${z.klient.prijmeni}`.toLowerCase().includes(form.zarizeniSearch.toLowerCase())
  )

  async function createNavsteva() {
    if (!form.planovanyTermin) return
    setSaving(true)
    try {
      const dt = `${form.planovanyTermin}T${form.cas}:00`
      if (form.kontraktId) {
        await fetch(`/api/servis/navstevy/${form.kontraktId}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planovanyTermin: dt,
            typ: form.typ,
            technikId: form.technikId || null,
            poznamka: form.poznamka || null,
          }),
        })
      } else {
        await fetch('/api/servis/navstevy', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            planovanyTermin: dt,
            typ: form.typ,
            technikId: form.technikId || null,
            poznamka: form.poznamka || null,
            zarizeniId: form.zarizeniId || null,
            klientId: form.klientId || null,
          }),
        })
      }
      setNovaNavstevaOpen(false)
      setForm(emptyForm)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  const grouped = groupByWeek(navstevy)
  const sortedWeeks = Object.keys(grouped).sort()

  // Calendar data
  const calYear = calDate.getFullYear()
  const calMonth = calDate.getMonth()
  const calDays = getDaysInMonth(calYear, calMonth)
  const navstevyByDay: Record<string, Navsteva[]> = {}
  for (const n of navstevy) {
    const key = n.planovanyTermin.split('T')[0]
    if (!navstevyByDay[key]) navstevyByDay[key] = []
    navstevyByDay[key].push(n)
  }

  return (
    <>
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={() => setView('seznam')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'seznam' ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            ☰ Seznam
          </button>
          <button
            onClick={() => setView('mesic')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${view === 'mesic' ? 'bg-green-600 text-white' : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
          >
            📅 Měsíc
          </button>
        </div>
        <button
          onClick={() => setNovaNavstevaOpen(true)}
          className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
        >
          + Nová návštěva
        </button>
      </div>

      {/* Seznam view */}
      {view === 'seznam' && (
        <>
          {navstevy.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
              <p className="text-gray-500 dark:text-slate-400">Žádné nadcházející servisní návštěvy</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedWeeks.map(weekKey => (
                <div key={weekKey} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
                  <div className="px-5 py-3 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-white">{weekLabel(weekKey)}</h3>
                      <p className="text-xs text-gray-500 dark:text-slate-400">{grouped[weekKey].length} {grouped[weekKey].length === 1 ? 'návštěva' : grouped[weekKey].length < 5 ? 'návštěvy' : 'návštěv'}</p>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {grouped[weekKey].map(n => {
                      const datum = new Date(n.planovanyTermin)
                      const isToday = datum.toDateString() === today.toDateString()
                      const isPast = datum < today && n.stav === 'PLANOVANA'
                      return (
                        <div key={n.id} className={`flex items-center gap-4 px-5 py-3 ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                          {/* Date */}
                          <div className="flex-shrink-0 w-14 text-center">
                            <p className={`text-lg font-bold leading-none ${isPast ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                              {datum.getDate()}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{datum.toLocaleDateString('cs-CZ', { weekday: 'short' })}</p>
                            <p className="text-xs text-gray-400 dark:text-slate-500">{datum.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</p>
                          </div>

                          {/* Technik color bar */}
                          <div className={`w-1 h-12 rounded-full flex-shrink-0 ${technikColor(n.technikId, orgUsers)}`} />

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 dark:text-white truncate">
                              {n.kontrakt?.klient ? `${n.kontrakt.klient.jmeno} ${n.kontrakt.klient.prijmeni}` : '—'}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              {n.zarizeni && (
                                <span className="text-xs text-gray-500 dark:text-slate-400">{n.zarizeni.nazev}</span>
                              )}
                              {!n.zarizeni && n.kontrakt && (
                                <span className="text-xs text-gray-500 dark:text-slate-400">{n.kontrakt.nazev}</span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${stavColors[n.stav]}`}>
                                {stavLabels[n.stav]}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-slate-500">{navstevaTypLabels[n.typ]}</span>
                            </div>
                          </div>

                          {/* Technik + navigate */}
                          <div className="flex-shrink-0 text-right hidden sm:block space-y-1.5">
                            {n.technik ? (
                              <p className="text-sm font-medium text-gray-700 dark:text-slate-300">{n.technik.jmeno}</p>
                            ) : (
                              <p className="text-sm text-gray-400 dark:text-slate-500 italic">Nepřiřazen</p>
                            )}
                            {n.kontrakt?.klient && (n.kontrakt.klient.ulice || n.kontrakt.klient.mesto) && (
                              <NavigateButton
                                adresa={[n.kontrakt.klient.ulice, [n.kontrakt.klient.mesto, n.kontrakt.klient.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')}
                                label="Navigovat"
                                size="xs"
                              />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Měsíc view */}
      {view === 'mesic' && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {/* Month nav */}
          <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <button
              onClick={() => setCalDate(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() - 1); return nd })}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400"
            >
              ←
            </button>
            <h3 className="font-semibold text-gray-900 dark:text-white capitalize">
              {calDate.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' })}
            </h3>
            <button
              onClick={() => setCalDate(d => { const nd = new Date(d); nd.setMonth(nd.getMonth() + 1); return nd })}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-600 dark:text-slate-400"
            >
              →
            </button>
          </div>
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700">
            {['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne'].map(d => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500 dark:text-slate-400">{d}</div>
            ))}
          </div>
          {/* Calendar grid */}
          <div className="grid grid-cols-7">
            {/* Offset for first day */}
            {Array.from({ length: (calDays[0].getDay() || 7) - 1 }).map((_, i) => (
              <div key={`empty-${i}`} className="h-20 border-b border-r border-gray-100 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/20" />
            ))}
            {calDays.map(day => {
              const key = day.toISOString().split('T')[0]
              const dayNavstevy = navstevyByDay[key] ?? []
              const isToday = day.toDateString() === today.toDateString()
              return (
                <div key={key} className={`h-20 border-b border-r border-gray-100 dark:border-slate-700 p-1 overflow-hidden ${isToday ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                  <p className={`text-xs font-semibold mb-1 ${isToday ? 'text-primary dark:text-primary-light' : 'text-gray-700 dark:text-slate-300'}`}>
                    {day.getDate()}
                  </p>
                  {dayNavstevy.slice(0, 2).map(n => (
                    <div key={n.id} className="text-xs bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300 rounded px-1 py-0.5 mb-0.5 truncate">
                      {n.kontrakt?.klient ? `${n.kontrakt.klient.jmeno}` : n.zarizeni?.nazev ?? '—'}
                    </div>
                  ))}
                  {dayNavstevy.length > 2 && (
                    <div className="text-xs text-gray-400 dark:text-slate-500">+{dayNavstevy.length - 2} další</div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Nová návštěva modal */}
      {novaNavstevaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nová servisní návštěva</h3>
              <button onClick={() => { setNovaNavstevaOpen(false); setForm(emptyForm) }} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Zařízení search */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Zařízení</label>
                <input
                  type="text"
                  value={form.zarizeniSearch}
                  onChange={e => setForm(f => ({ ...f, zarizeniSearch: e.target.value, zarizeniId: '', klientId: '', kontraktId: '' }))}
                  placeholder="Hledat zařízení nebo klienta..."
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                />
                {form.zarizeniSearch && !form.zarizeniId && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
                    {filteredZarizeni.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Nic nenalezeno</p>
                    ) : filteredZarizeni.slice(0, 6).map(z => (
                      <button
                        key={z.id}
                        onClick={() => setForm(f => ({
                          ...f,
                          zarizeniId: z.id,
                          klientId: z.klient.id,
                          kontraktId: z.kontraktyId ?? '',
                          zarizeniSearch: `${z.nazev} (${z.klient.jmeno} ${z.klient.prijmeni})`,
                        }))}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{z.nazev}</span>
                        <span className="text-gray-500 dark:text-slate-400"> · {z.klient.jmeno} {z.klient.prijmeni}</span>
                      </button>
                    ))}
                  </div>
                )}
                {form.zarizeniId && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ Zařízení vybráno{form.kontraktId ? ' · kontrakt nalezen' : ''}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Typ</label>
                <select
                  value={form.typ}
                  onChange={e => setForm(f => ({ ...f, typ: e.target.value as NavstevaTyp }))}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {Object.entries(navstevaTypLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Datum *</label>
                  <input
                    type="date"
                    value={form.planovanyTermin}
                    onChange={e => setForm(f => ({ ...f, planovanyTermin: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Čas</label>
                  <input
                    type="time"
                    value={form.cas}
                    onChange={e => setForm(f => ({ ...f, cas: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Odhadovaná délka (min)</label>
                  <input
                    type="number"
                    min="15"
                    step="15"
                    value={form.trvaniMinut}
                    onChange={e => setForm(f => ({ ...f, trvaniMinut: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Technik</label>
                  <select
                    value={form.technikId}
                    onChange={e => setForm(f => ({ ...f, technikId: e.target.value }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">— nepřiřazen —</option>
                    {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Poznámka</label>
                <textarea
                  rows={2}
                  value={form.poznamka}
                  onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))}
                  placeholder="Volitelná poznámka pro technika..."
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => { setNovaNavstevaOpen(false); setForm(emptyForm) }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Zrušit
              </button>
              <button
                onClick={createNavsteva}
                disabled={!form.planovanyTermin || saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Ukládám…' : 'Naplánovat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
