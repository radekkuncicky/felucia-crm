'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { formatDate } from '@/lib/format'
import { IconPhone, IconMail, IconHandshake, IconNote, IconCheck, IconHammer } from '@/components/ui/Icons'
import type { CoMamDelatPolozka, CoMamDelatSkupina } from '@/app/api/dashboard/ukoly/route'

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
  noveOP: { id: string; kod: string | null; klient: string; technologie: string; stav: string; vytvoreno: string }[]
  bliziciSeServisy?: { id: string; planovanyTermin: string; kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null }[]
  servisyPoTerminu?: { id: string; planovanyTermin: string; zarizeniNazev: string | null; kontrakt: { nazev: string; klient: { jmeno: string; prijmeni: string } } | null }[]
}

const SKUPINY: { key: CoMamDelatSkupina; label: string; cls: string }[] = [
  { key: 'PO_TERMINU',  label: 'Po termínu',   cls: 'text-red-600 dark:text-red-400' },
  { key: 'DNES',        label: 'Dnes',         cls: 'text-amber-600 dark:text-amber-400' },
  { key: 'TYDEN',       label: 'Tento týden',  cls: 'text-gray-700 dark:text-slate-300' },
  { key: 'BEZ_TERMINU', label: 'Bez termínu',  cls: 'text-gray-500 dark:text-slate-400' },
]

function TypIcon({ p }: { p: CoMamDelatPolozka }) {
  const c = 'w-4 h-4 flex-shrink-0'
  if (p.druh === 'UKOL') return <IconHammer className={`${c} text-emerald-600`} />
  switch (p.typ) {
    case 'HOVOR': return <IconPhone className={`${c} text-sky-500`} />
    case 'EMAIL': return <IconMail className={`${c} text-violet-500`} />
    case 'SCHUZKA': return <IconHandshake className={`${c} text-amber-500`} />
    case 'UKOL': return <IconCheck className={`${c} text-emerald-500`} />
    default: return <IconNote className={`${c} text-gray-400`} />
  }
}

function Badge({ n, tone = 'gray' }: { n: number; tone?: 'gray' | 'red' }) {
  const cls = tone === 'red' && n > 0
    ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300'
  return <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs font-bold leading-none ${cls}`}>{n}</span>
}

function Section({ title, badge, open, onToggle, children }: {
  title: string; badge: number; open: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <div className="border-t border-gray-100 dark:border-slate-700">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors text-left"
      >
        <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
          {title}<Badge n={badge} />
        </span>
        <svg className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-5 pb-3">{children}</div>}
    </div>
  )
}

const rowCls = 'flex items-center justify-between gap-3 text-sm hover:bg-gray-50 dark:hover:bg-slate-700/40 rounded-lg px-2 py-1.5 -mx-2 transition-colors'

/**
 * „Co mám dělat“ — vždy viditelný přehled: moje OP kontakty + úkoly zakázek podle termínu,
 * pod tím sbalené sekce OP bez aktivity / nové OP / servisy (dřívější žlutý ReminderPanel).
 */
export default function CoMamDelatPanel() {
  const [polozky, setPolozky] = useState<CoMamDelatPolozka[] | null>(null)
  const [notif, setNotif] = useState<NotifData | null>(null)
  const [openSection, setOpenSection] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/dashboard/ukoly').then(r => r.ok ? r.json() : { polozky: [] }).then(d => setPolozky(d.polozky ?? [])).catch(() => setPolozky([]))
    fetch('/api/notifications/list').then(r => r.ok ? r.json() : null).then(setNotif).catch(() => {})
  }, [])

  async function hotovo(p: CoMamDelatPolozka) {
    setBusy(p.id)
    const prev = polozky
    setPolozky(list => (list ?? []).filter(x => x.id !== p.id))
    try {
      const res = p.druh === 'AKTIVITA'
        ? await fetch(`/api/activities/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stav: 'DOKONCENA' }) })
        : await fetch(`/api/zakazky/${p.parentId}/ukoly/${p.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ hotovo: true }) })
      if (!res.ok) {
        setPolozky(prev)
        toast.error('Nepodařilo se označit jako hotové')
      }
    } catch {
      setPolozky(prev)
      toast.error('Nepodařilo se označit jako hotové')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (k: string) => setOpenSection(s => (s === k ? null : k))

  const poTerminu = (polozky ?? []).filter(p => p.skupina === 'PO_TERMINU').length
  const dnes = (polozky ?? []).filter(p => p.skupina === 'DNES').length
  const op = notif?.opBezAktivity ?? []
  const nove = notif?.noveOP ?? []
  const servisy = notif?.bliziciSeServisy ?? []
  const servisyOpo = notif?.servisyPoTerminu ?? []

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm overflow-hidden">
      <div className="px-5 py-3.5 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          Co mám dělat
          {polozky && poTerminu > 0 && <Badge n={poTerminu} tone="red" />}
          {polozky && dnes > 0 && <span className="text-xs font-normal text-amber-600 dark:text-amber-400">{dnes} dnes</span>}
        </h2>
        {polozky === null && <span className="text-xs text-gray-400">Načítám…</span>}
      </div>

      {polozky !== null && polozky.length === 0 && (
        <p className="px-5 pb-4 text-sm text-gray-500 dark:text-slate-400">Nic naplánovaného. Nový kontakt přidáte u OP, úkol u zakázky.</p>
      )}

      {polozky && polozky.length > 0 && (
        <div className="px-5 pb-3 space-y-3">
          {SKUPINY.map(sk => {
            const items = polozky.filter(p => p.skupina === sk.key)
            if (items.length === 0) return null
            return (
              <div key={sk.key}>
                <p className={`text-xs font-semibold uppercase tracking-wide mb-1 ${sk.cls}`}>{sk.label}</p>
                <div className="space-y-0.5">
                  {items.map(p => (
                    <div key={p.id} className={rowCls}>
                      <button
                        onClick={() => hotovo(p)}
                        disabled={busy === p.id}
                        title="Označit hotovo"
                        className="w-5 h-5 rounded border-2 border-gray-300 dark:border-slate-500 hover:border-primary hover:bg-primary/10 flex-shrink-0 disabled:opacity-50"
                        aria-label="Označit hotovo"
                      />
                      <TypIcon p={p} />
                      <Link href={p.kontext.href} className="min-w-0 flex-1">
                        <p className="text-gray-800 dark:text-slate-200 line-clamp-1">{p.text}</p>
                        <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                          <span className="font-mono">{p.kontext.label}</span>{p.kontext.popis ? ` · ${p.kontext.popis}` : ''}
                        </p>
                      </Link>
                      {p.datum && (
                        <span className={`text-xs flex-shrink-0 ${sk.key === 'PO_TERMINU' ? 'text-red-600 dark:text-red-400 font-medium' : 'text-gray-500 dark:text-slate-400'}`}>
                          {formatDate(p.datum)}{p.cas ? ` ${p.cas}` : ''}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Sbalené přehledy z bývalého ReminderPanelu */}
      {notif && (op.length > 0 || nove.length > 0 || servisy.length > 0 || servisyOpo.length > 0) && (
        <div>
          {op.length > 0 && (
            <Section title="OP bez aktivity" badge={op.length} open={openSection === 'op'} onToggle={() => toggle('op')}>
              <div className="space-y-0.5">
                {op.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`} className={rowCls}>
                    <div className="flex items-center gap-2 min-w-0">
                      {d.kod && <span className="font-mono text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{d.kod}</span>}
                      <span className="text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">
                      {d.dniBezAktivity === null ? 'bez aktivity' : `${d.dniBezAktivity} dní`}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {nove.length > 0 && (
            <Section title="Nové OP (24h)" badge={nove.length} open={openSection === 'nove'} onToggle={() => toggle('nove')}>
              <div className="space-y-0.5">
                {nove.map(d => (
                  <Link key={d.id} href={`/deals/${d.id}`} className={rowCls}>
                    <div className="flex items-center gap-2 min-w-0">
                      {d.kod && <span className="font-mono text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{d.kod}</span>}
                      <span className="text-gray-800 dark:text-slate-200 truncate">{d.klient}</span>
                      <span className="text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">{techLabels[d.technologie] ?? d.technologie}</span>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-slate-700 text-gray-700 dark:text-slate-300 flex-shrink-0">
                      {stavLabels[d.stav] ?? d.stav}
                    </span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {servisyOpo.length > 0 && (
            <Section title="Servisy po termínu" badge={servisyOpo.length} open={openSection === 'servisyopo'} onToggle={() => toggle('servisyopo')}>
              <div className="space-y-0.5">
                {servisyOpo.map(s => (
                  <Link key={s.id} href="/servis/plan" className={rowCls}>
                    <div className="min-w-0">
                      <p className="text-gray-800 dark:text-slate-200 truncate">
                        {s.kontrakt?.klient.jmeno} {s.kontrakt?.klient.prijmeni}{s.zarizeniNazev ? ` · ${s.zarizeniNazev}` : ''}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{s.kontrakt?.nazev ?? '—'}</p>
                    </div>
                    <span className="text-xs flex-shrink-0 text-red-600 dark:text-red-400 font-medium">{formatDate(s.planovanyTermin)}</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}

          {servisy.length > 0 && (
            <Section title="Blížící se servisy" badge={servisy.length} open={openSection === 'servisy'} onToggle={() => toggle('servisy')}>
              <div className="space-y-0.5">
                {servisy.map(s => (
                  <Link key={s.id} href="/servis/plan" className={rowCls}>
                    <div className="min-w-0">
                      <p className="text-gray-800 dark:text-slate-200 truncate">{s.kontrakt?.klient.jmeno} {s.kontrakt?.klient.prijmeni}</p>
                      {s.kontrakt && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{s.kontrakt.nazev}</p>}
                    </div>
                    <span className="text-xs flex-shrink-0 text-gray-500 dark:text-slate-400">{formatDate(s.planovanyTermin)}</span>
                  </Link>
                ))}
              </div>
            </Section>
          )}
        </div>
      )}
    </div>
  )
}
