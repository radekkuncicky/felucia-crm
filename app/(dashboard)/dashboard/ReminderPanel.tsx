'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const techLabels: Record<string, string> = {
  KLIMA: 'Klimatizace', TEPELNE_CERPADLO: 'Tepelné čerpadlo',
  REKUPERACE: 'Rekuperace', PODLAHOVE_TOPENI: 'Podlahové topení',
  VZDUCHOTECHNIKA: 'Vzduchotechnika', JINE: 'Jiné',
}

const stavLabels: Record<string, string> = {
  NOVY: 'Nový', JEDNANI: 'Jednání', NABIDKA: 'Nabídka',
  PRED_UZAVRENIM: 'Před uzavřením', USPECH: 'Úspěch', PAS: 'Prohráno',
}

interface NotifData {
  opBezAktivity: { id: string; kod: string | null; klient: string; dniBezAktivity: number | null }[]
  prosleAktivity: { id: string; typ: string; popis: string; datum: string; dealId: string; dealKod: string | null; dealPredmet: string | null }[]
  nesplneneUkoly: { id: string; popis: string; datum: string; dealId: string; dealKod: string | null; dealPredmet: string | null }[]
  noveOP: { id: string; kod: string | null; klient: string; technologie: string; stav: string; vytvoreno: string }[]
  bliziciSeServisy?: { id: string; planovanyTermin: string; kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null }[]
  servisyPoTerminu?: { id: string; planovanyTermin: string; zarizeniNazev: string | null; kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null }[]
}

function todayKey() {
  return `reminder_dismissed_${new Date().toISOString().slice(0, 10)}`
}

function isReminderDay() {
  const day = new Date().getDay() // 0=Sun,1=Mon,...,6=Sat
  return day === 1 || day === 3 || day === 5 // Mon, Wed, Fri
}

function Badge({ n }: { n: number }) {
  return (
    <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold leading-none ${n > 0 ? 'bg-yellow-700 text-yellow-100' : 'bg-yellow-200 text-yellow-600'}`}>
      {n}
    </span>
  )
}

function Section({ title, badge, open, onToggle, children }: {
  title: string; badge: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border-t border-yellow-200 dark:border-yellow-800/50">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors text-left"
      >
        <span className="text-sm font-semibold text-yellow-900 dark:text-yellow-100">
          {title}
          <Badge n={badge} />
        </span>
        <svg
          className={`w-4 h-4 text-yellow-600 dark:text-yellow-400 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-4 pb-3">{children}</div>}
    </div>
  )
}

export default function ReminderPanel() {
  const [visible, setVisible] = useState(false)
  const [data, setData] = useState<NotifData | null>(null)
  const [loading, setLoading] = useState(false)
  const [openSection, setOpenSection] = useState<string | null>('op')

  useEffect(() => {
    if (!isReminderDay()) return
    if (localStorage.getItem(todayKey())) return
    setVisible(true)
    setLoading(true)
    fetch('/api/notifications/list')
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [])

  function dismiss() {
    localStorage.setItem(todayKey(), '1')
    setVisible(false)
  }

  function toggleSection(key: string) {
    setOpenSection(s => s === key ? null : key)
  }

  if (!visible) return null

  const op = data?.opBezAktivity ?? []
  const prosle = data?.prosleAktivity ?? []
  const ukoly = data?.nesplneneUkoly ?? []
  const nove = data?.noveOP ?? []
  const servisy = data?.bliziciSeServisy ?? []
  const servisyOpo = data?.servisyPoTerminu ?? []

  return (
    <div className="rounded-xl overflow-hidden border border-yellow-300 dark:border-yellow-700 shadow-sm mb-6">
      {/* Header */}
      <div className="bg-yellow-400 dark:bg-yellow-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-yellow-900 dark:text-yellow-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
          </svg>
          <span className="font-bold text-yellow-900 dark:text-yellow-100">Připomínky na dnes</span>
          {loading && <span className="text-xs text-yellow-800 dark:text-yellow-200 ml-2">Načítám…</span>}
        </div>
        <button
          onClick={dismiss}
          className="text-xs bg-yellow-300 dark:bg-yellow-600 hover:bg-yellow-200 dark:hover:bg-yellow-500 text-yellow-900 dark:text-yellow-100 px-3 py-1 rounded-lg font-medium transition-colors"
        >
          Označit vše jako zkontrolováno
        </button>
      </div>

      <div className="bg-yellow-50 dark:bg-yellow-900/10">
        {/* OP bez aktivity */}
        <Section title="OP bez aktivity" badge={op.length} open={openSection === 'op'} onToggle={() => toggleSection('op')}>
          {op.length === 0 ? (
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Vše v pořádku ✓</p>
          ) : (
            <div className="space-y-1.5">
              {op.map(d => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {d.kod && <span className="font-mono text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 rounded flex-shrink-0">{d.kod}</span>}
                    <span className="text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                  </div>
                  <span className="text-xs text-yellow-700 dark:text-yellow-400 flex-shrink-0">
                    {d.dniBezAktivity != null ? `${d.dniBezAktivity} dní` : 'nikdy'}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Prošlé aktivity */}
        <Section title="Prošlé aktivity" badge={prosle.length} open={openSection === 'prosle'} onToggle={() => toggleSection('prosle')}>
          {prosle.length === 0 ? (
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Žádné prošlé aktivity ✓</p>
          ) : (
            <div className="space-y-1.5">
              {prosle.map(a => (
                <Link
                  key={a.id}
                  href={`/deals/${a.dealId}?tab=aktivity`}
                  className="flex items-start justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-gray-800 dark:text-slate-200 line-clamp-1">{a.popis}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {a.dealKod ? `${a.dealKod} · ` : ''}{a.dealPredmet ?? 'OP'}
                    </p>
                  </div>
                  <span className="text-xs bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full flex-shrink-0 font-medium whitespace-nowrap mt-0.5">
                    Prošlé
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Nesplněné úkoly */}
        <Section title="Nesplněné úkoly" badge={ukoly.length} open={openSection === 'ukoly'} onToggle={() => toggleSection('ukoly')}>
          {ukoly.length === 0 ? (
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Žádné nesplněné úkoly ✓</p>
          ) : (
            <div className="space-y-1.5">
              {ukoly.map(u => (
                <Link
                  key={u.id}
                  href={`/deals/${u.dealId}?tab=aktivity`}
                  className="flex items-start justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-gray-800 dark:text-slate-200 line-clamp-1">{u.popis}</p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400">
                      {u.dealKod ? `${u.dealKod} · ` : ''}{u.dealPredmet ?? 'OP'}
                    </p>
                  </div>
                  <span className="text-xs text-yellow-600 dark:text-yellow-500 flex-shrink-0 mt-0.5">
                    {new Date(u.datum).toLocaleDateString('cs-CZ')}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Nové OP */}
        <Section title="Nové OP (24h)" badge={nove.length} open={openSection === 'nove'} onToggle={() => toggleSection('nove')}>
          {nove.length === 0 ? (
            <p className="text-sm text-yellow-700 dark:text-yellow-400">Žádné nové OP za posledních 24h</p>
          ) : (
            <div className="space-y-1.5">
              {nove.map(d => (
                <Link
                  key={d.id}
                  href={`/deals/${d.id}`}
                  className="flex items-center justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {d.kod && <span className="font-mono text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-200 dark:bg-yellow-800 px-1.5 py-0.5 rounded flex-shrink-0">{d.kod}</span>}
                    <span className="text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{techLabels[d.technologie] ?? d.technologie}</span>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-200 dark:bg-slate-700 text-gray-700 dark:text-slate-300 flex-shrink-0">
                    {stavLabels[d.stav] ?? d.stav}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* Servisy po termínu */}
        {servisyOpo.length > 0 && (
          <Section title="Servisy po termínu" badge={servisyOpo.length} open={openSection === 'servisyopo'} onToggle={() => toggleSection('servisyopo')}>
            <div className="space-y-1.5">
              {servisyOpo.map(s => (
                <Link
                  key={s.id}
                  href="/servis/plan"
                  className="flex items-center justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-gray-800 dark:text-slate-200 truncate">
                      {s.kontrakt?.klient.jmeno} {s.kontrakt?.klient.prijmeni}
                      {s.zarizeniNazev ? ` · ${s.zarizeniNazev}` : ''}
                    </p>
                    <p className="text-xs text-yellow-700 dark:text-yellow-400 truncate">{s.kontrakt?.nazev ?? '—'}</p>
                  </div>
                  <span className="text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400">
                    {new Date(s.planovanyTermin).toLocaleDateString('cs-CZ')}
                  </span>
                </Link>
              ))}
            </div>
          </Section>
        )}

        {/* Blížící se servisy - only shown if data present */}
        {servisy.length > 0 && (
          <Section title="Blížící se servisy" badge={servisy.length} open={openSection === 'servisy'} onToggle={() => toggleSection('servisy')}>
            <div className="space-y-1.5">
              {servisy.map(s => {
                const isUrgent = new Date(s.planovanyTermin) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                return (
                  <Link
                    key={s.id}
                    href="/servis/plan"
                    className="flex items-center justify-between gap-3 text-sm hover:bg-yellow-100 dark:hover:bg-yellow-900/30 rounded-lg px-2 py-1.5 -mx-2 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-gray-800 dark:text-slate-200 truncate">
                        {s.kontrakt?.klient.jmeno} {s.kontrakt?.klient.prijmeni}
                      </p>
                      {s.kontrakt && <p className="text-xs text-yellow-700 dark:text-yellow-400 truncate">{s.kontrakt.nazev}</p>}
                    </div>
                    <span className={`text-xs flex-shrink-0 px-1.5 py-0.5 rounded-full font-medium ${
                      isUrgent
                        ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                        : 'text-yellow-700 dark:text-yellow-400'
                    }`}>
                      {new Date(s.planovanyTermin).toLocaleDateString('cs-CZ')}
                    </span>
                  </Link>
                )
              })}
            </div>
          </Section>
        )}
      </div>
    </div>
  )
}
