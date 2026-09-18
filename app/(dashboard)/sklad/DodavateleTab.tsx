'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import AresAutocomplete from '@/components/AresAutocomplete'
import type { AresFirma } from '@/hooks/useAresLookup'
import { doplnZAres } from '@/lib/ares'
import { confirmDialog } from '@/components/ui/confirm'
import { formatDate, formatKcPresne } from '@/lib/format'
import { OBJ_STAV_LABELS, OBJ_STAV_COLORS } from './objednavkyStav'

/** Záložka Dodavatelé na /sklad — seznam, založení/úprava, detail s produkty a objednávkami. */

interface Dodavatel {
  id: string
  nazev: string
  ico: string | null
  dic: string | null
  email: string | null
  telefon: string | null
  kontaktOsoba: string | null
  ulice: string | null
  mesto: string | null
  psc: string | null
  poznamka: string | null
  aktivni: boolean
  vytvoreno: string
  pocetProduktu: number
  pocetObjednavek: number
}

interface Detail extends Omit<Dodavatel, 'pocetProduktu' | 'pocetObjednavek'> {
  produkty: {
    id: string; objednaciKod: string | null; nakupniCena: number | null; dodaciLhuta: string | null; hlavni: boolean
    product: { id: string; kod: string | null; nazev: string; jednotka: string; aktivni: boolean }
  }[]
  objednavky: { id: string; cislo: string; stav: string; vytvoreno: string; zakazka: { id: string; cislo: string; nazev: string } | null }[]
}

interface Props {
  canEdit: boolean
  showNakupky: boolean
  search: string
  /** předvybraný dodavatel z URL (?id=) */
  initialId?: string | null
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary'
const lbl = 'block text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1'
const thCls = 'px-4 py-3 text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide'

const FIELDS: { key: keyof DodavatelForm; label: string; placeholder?: string; type?: string; wide?: boolean }[] = [
  { key: 'nazev', label: 'Název *', wide: true },
  { key: 'ico', label: 'IČO' },
  { key: 'dic', label: 'DIČ' },
  { key: 'email', label: 'E-mail pro objednávky', type: 'email', placeholder: 'objednavky@dodavatel.cz' },
  { key: 'telefon', label: 'Telefon' },
  { key: 'kontaktOsoba', label: 'Kontaktní osoba' },
  { key: 'ulice', label: 'Ulice a č. p.' },
  { key: 'mesto', label: 'Město' },
  { key: 'psc', label: 'PSČ' },
  { key: 'poznamka', label: 'Poznámka', wide: true },
]

type DodavatelForm = { nazev: string; ico: string; dic: string; email: string; telefon: string; kontaktOsoba: string; ulice: string; mesto: string; psc: string; poznamka: string }
const emptyForm: DodavatelForm = { nazev: '', ico: '', dic: '', email: '', telefon: '', kontaktOsoba: '', ulice: '', mesto: '', psc: '', poznamka: '' }

/** Které pole formuláře dodavatele bere kterou hodnotu z ARES (doplňují se jen prázdná) */
const ARES_MAPA = { nazev: 'nazev', ico: 'ico', dic: 'dic', ulice: 'ulice', mesto: 'mesto', psc: 'psc' } as const

function DodavatelModal({ initial, onClose, onSaved }: { initial: Dodavatel | null; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<DodavatelForm>(initial ? {
    nazev: initial.nazev, ico: initial.ico ?? '', dic: initial.dic ?? '', email: initial.email ?? '', telefon: initial.telefon ?? '',
    kontaktOsoba: initial.kontaktOsoba ?? '', ulice: initial.ulice ?? '', mesto: initial.mesto ?? '', psc: initial.psc ?? '', poznamka: initial.poznamka ?? '',
  } : emptyForm)
  const [saving, setSaving] = useState(false)
  const [aresLoading, setAresLoading] = useState(false)

  /** Doplní jen prázdná pole; toast řekne, kolik se jich doplnilo (u vyplněného formuláře nic nepřepisuje). */
  function applyAres(firma: AresFirma) {
    setForm(prev => {
      const next = doplnZAres(prev, firma, ARES_MAPA)
      const doplneno = (Object.keys(ARES_MAPA) as (keyof DodavatelForm)[]).filter(k => prev[k] !== next[k]).length
      if (doplneno === 0) toast.info(`${firma.nazev}: všechna pole už jsou vyplněná, nic nepřepisuji`)
      else toast.success(`Doplněno z ARES: ${firma.nazev}`)
      return next
    })
  }

  async function loadFromAres(ico: string, tiche = false) {
    setAresLoading(true)
    try {
      const res = await fetch(`/api/ares?q=${encodeURIComponent(ico)}`)
      const firmy = res.ok ? await res.json() as AresFirma[] : []
      if (!firmy.length) { if (!tiche) toast.error('IČO nenalezeno v ARES'); return }
      applyAres(firmy[0])
    } catch {
      if (!tiche) toast.error('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  // Auto-lustrace po zadání 8 číslic IČO — jen u nového dodavatele bez názvu (při editaci nic samo nespouštět)
  const icoCiste = form.ico.replace(/\s/g, '')
  const autoLookup = !initial && form.nazev.trim() === '' && /^\d{8}$/.test(icoCiste)
  useEffect(() => {
    if (!autoLookup) return
    loadFromAres(icoCiste, true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLookup, icoCiste])

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(initial ? `/api/dodavatele/${initial.id}` : '/api/dodavatele', {
        method: initial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error ?? 'Uložení selhalo'); return }
      toast.success(initial ? 'Dodavatel upraven' : 'Dodavatel založen')
      onSaved()
      onClose()
    } finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{initial ? 'Upravit dodavatele' : 'Nový dodavatel'}</h2>
        </div>
        <form onSubmit={submit} className="px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className={lbl}>Vyhledat firmu v ARES</label>
              <AresAutocomplete onSelect={applyAres} placeholder="Název firmy nebo IČO" />
              <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Po výběru se doplní název, IČO, DIČ a sídlo — ručně vyplněná pole zůstanou.</p>
            </div>
            {FIELDS.map(f => (
              <div key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                <label className={lbl}>{f.label}</label>
                {f.key === 'ico' ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      inputMode="numeric"
                      value={form.ico}
                      onChange={e => setForm(prev => ({ ...prev, ico: e.target.value }))}
                      placeholder="12345678"
                      className={inp}
                    />
                    <button
                      type="button"
                      onClick={() => loadFromAres(icoCiste)}
                      disabled={aresLoading || !icoCiste}
                      title="Načíst z ARES"
                      className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-40 whitespace-nowrap"
                    >
                      {aresLoading ? '…' : 'ARES'}
                    </button>
                  </div>
                ) : (
                  <input
                    type={f.type ?? 'text'}
                    value={form[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    required={f.key === 'nazev'}
                    placeholder={f.placeholder}
                    className={inp}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="flex gap-3 justify-end pt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">Zrušit</button>
            <button type="submit" disabled={saving || !form.nazev.trim()} className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">{saving ? 'Ukládám…' : 'Uložit'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function DodavateleTab({ canEdit, showNakupky, search, initialId }: Props) {
  const [rows, setRows] = useState<Dodavatel[] | null>(null)
  const [showNeaktivni, setShowNeaktivni] = useState(false)
  const [modal, setModal] = useState<{ open: boolean; initial: Dodavatel | null }>({ open: false, initial: null })
  const [detailId, setDetailId] = useState<string | null>(initialId ?? null)
  const [detail, setDetail] = useState<Detail | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/dodavatele${showNeaktivni ? '?vse=1' : ''}`)
    if (res.ok) setRows(await res.json())
  }, [showNeaktivni])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!detailId) { setDetail(null); return }
    let cancelled = false
    fetch(`/api/dodavatele/${detailId}`).then(r => r.ok ? r.json() : null).then(d => { if (!cancelled) setDetail(d) })
    return () => { cancelled = true }
  }, [detailId])

  async function remove(d: Dodavatel) {
    const msg = d.pocetObjednavek > 0
      ? `Dodavatel ${d.nazev} má ${d.pocetObjednavek} objednávek — bude jen deaktivován. Pokračovat?`
      : `Smazat dodavatele ${d.nazev}?`
    if (!(await confirmDialog(msg, { confirmLabel: d.pocetObjednavek > 0 ? 'Deaktivovat' : 'Smazat' }))) return
    const res = await fetch(`/api/dodavatele/${d.id}`, { method: 'DELETE' })
    if (res.ok) { toast.success(d.pocetObjednavek > 0 ? 'Dodavatel deaktivován' : 'Dodavatel smazán'); if (detailId === d.id) setDetailId(null); load() }
  }

  const q = search.toLowerCase()
  const filtered = (rows ?? []).filter(d => !q || `${d.nazev} ${d.ico ?? ''} ${d.email ?? ''} ${d.kontaktOsoba ?? ''} ${d.mesto ?? ''}`.toLowerCase().includes(q))

  return (
    <>
      {modal.open && <DodavatelModal initial={modal.initial} onClose={() => setModal({ open: false, initial: null })} onSaved={() => { load(); if (detailId) setDetailId(id => id) }} />}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <label className="inline-flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400 cursor-pointer">
          <input type="checkbox" checked={showNeaktivni} onChange={e => setShowNeaktivni(e.target.checked)} className="rounded border-gray-300" />
          Zobrazit neaktivní
        </label>
        {canEdit && (
          <button onClick={() => setModal({ open: true, initial: null })} className="bg-green-600 hover:bg-green-700 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors">
            + Nový dodavatel
          </button>
        )}
      </div>

      <div className={`grid gap-4 ${detail ? 'lg:grid-cols-[1fr_1.2fr]' : ''}`}>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          {rows === null ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">Načítám…</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-14 text-gray-400 dark:text-slate-500 text-sm">
              {rows.length === 0 ? 'Zatím žádný dodavatel. Založte prvního a přiřaďte ho k produktům v katalogu.' : 'Nic neodpovídá filtru'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                    <th className={`text-left ${thCls}`}>Dodavatel</th>
                    <th className={`text-left ${thCls}`}>Kontakt</th>
                    <th className={`text-right ${thCls}`}>Produktů</th>
                    <th className={`text-right ${thCls}`}>Objednávek</th>
                    {canEdit && <th className={thCls} />}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-slate-700/50">
                  {filtered.map(d => (
                    <tr key={d.id} onClick={() => setDetailId(d.id === detailId ? null : d.id)} className={`cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 ${detailId === d.id ? 'bg-green-50/60 dark:bg-green-900/10' : ''}`}>
                      <td className="px-4 py-3">
                        <p className={`font-medium ${d.aktivni ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-slate-500'}`}>{d.nazev}{!d.aktivni && ' (neaktivní)'}</p>
                        {(d.ico || d.mesto) && <p className="text-xs text-gray-400 dark:text-slate-500">{[d.ico && `IČO ${d.ico}`, d.mesto].filter(Boolean).join(' · ')}</p>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {d.email && <p className="truncate max-w-[220px]">{d.email}</p>}
                        {d.telefon && <p className="text-xs">{d.telefon}</p>}
                        {!d.email && !d.telefon && <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">{d.pocetProduktu}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-slate-300">{d.pocetObjednavek}</td>
                      {canEdit && (
                        <td className="px-4 py-3 text-right whitespace-nowrap" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setModal({ open: true, initial: d })} className="text-xs text-gray-500 hover:text-gray-900 dark:hover:text-white mr-3">Upravit</button>
                          <button onClick={() => remove(d)} className="text-xs text-red-500 hover:text-red-700">{d.pocetObjednavek > 0 ? 'Deaktivovat' : 'Smazat'}</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {detail && (
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{detail.nazev}</h2>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {[detail.ico && `IČO ${detail.ico}`, detail.dic && `DIČ ${detail.dic}`, [detail.ulice, [detail.psc, detail.mesto].filter(Boolean).join(' ')].filter(Boolean).join(', ')].filter(Boolean).join(' · ') || 'Bez fakturačních údajů'}
                </p>
              </div>
              <button onClick={() => setDetailId(null)} className="text-gray-400 hover:text-gray-700 dark:hover:text-white" title="Zavřít">✕</button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className={lbl}>E-mail</p><p className="text-gray-900 dark:text-white break-all">{detail.email ?? '—'}</p></div>
              <div><p className={lbl}>Telefon</p><p className="text-gray-900 dark:text-white">{detail.telefon ?? '—'}</p></div>
              <div><p className={lbl}>Kontaktní osoba</p><p className="text-gray-900 dark:text-white">{detail.kontaktOsoba ?? '—'}</p></div>
              <div><p className={lbl}>Založen</p><p className="text-gray-900 dark:text-white">{formatDate(detail.vytvoreno)}</p></div>
              {detail.poznamka && <div className="col-span-2"><p className={lbl}>Poznámka</p><p className="text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{detail.poznamka}</p></div>}
            </div>

            <div>
              <h3 className={lbl}>Dodávané produkty ({detail.produkty.length})</h3>
              {detail.produkty.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500">Zatím žádný — přiřaďte dodavatele na detailu produktu v katalogu.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-700 text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {detail.produkty.map(p => (
                    <li key={p.id} className="px-3 py-2 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <Link href={`/products/${p.product.id}`} className="font-medium text-gray-900 dark:text-white hover:underline truncate block">{p.product.nazev}</Link>
                        <p className="text-xs text-gray-400 dark:text-slate-500 font-mono">{p.product.kod ?? ''}{p.objednaciKod ? ` → obj. ${p.objednaciKod}` : ''}</p>
                      </div>
                      {p.hlavni && <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">Hlavní</span>}
                      {showNakupky && <span className="text-gray-600 dark:text-slate-400 whitespace-nowrap">{p.nakupniCena !== null ? formatKcPresne(p.nakupniCena) : '—'}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h3 className={lbl}>Poslední objednávky</h3>
              {detail.objednavky.length === 0 ? (
                <p className="text-sm text-gray-400 dark:text-slate-500">Zatím žádná objednávka.</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-slate-700 text-sm border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden">
                  {detail.objednavky.map(o => (
                    <li key={o.id} className="px-3 py-2 flex items-center gap-3">
                      <Link href={o.zakazka ? `/zakazky/${o.zakazka.id}/objednavky/${o.id}` : `/sklad?tab=objednavky&id=${o.id}`} className="font-mono text-xs text-green-600 dark:text-green-400 hover:underline">{o.cislo}</Link>
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJ_STAV_COLORS[o.stav] ?? ''}`}>{OBJ_STAV_LABELS[o.stav] ?? o.stav}</span>
                      <span className="text-gray-500 dark:text-slate-400 truncate flex-1">{o.zakazka ? `${o.zakazka.cislo} · ${o.zakazka.nazev}` : ''}</span>
                      <span className="text-xs text-gray-400">{formatDate(o.vytvoreno)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
