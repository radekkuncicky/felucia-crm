'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import FilterDropdown from '@/components/ui/FilterDropdown'
import {
  type NavstevaTyp,
  SERVIS_STAV_LABELS,
  TYP_LABELS,
  stavLabel,
  stavColor,
  typLabel,
  jeProsla,
} from '@/lib/servisStav'

interface Row {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: string | null
  skutecnyTermin: string | null
  vyfakturovano: boolean
  technik: { id: string; jmeno: string } | null
  klientNazev: string | null
  predmet: string | null
}

interface OrgUser {
  id: string
  jmeno: string
}

interface ZarizeniListItem {
  id: string
  nazev: string
  typ: string
  klient: { id: string; jmeno: string; prijmeni: string }
  kontraktyId: string | null
}

interface Props {
  zakazky: Row[]
  orgUsers: OrgUser[]
  zarizeniList: ZarizeniListItem[]
  canCreate: boolean
}

const emptyForm = {
  zarizeniId: '',
  zarizeniSearch: '',
  klientId: '',
  kontraktId: '',
  typ: 'PLANOVANY_SERVIS' as NavstevaTyp,
  planovanyTermin: '',
  cas: '09:00',
  technikId: '',
  poznamka: '',
}

// Aktivní = dá se na nich pracovat; Hotové = práce skončila (vč. čekání na
// platbu/uzavření). ZRUSENA jen ve „Vše". Stejný vzor jako montážní zakázky.
const AKTIVNI_STAVY = ['NOVA', 'NAPLANOVANA', 'PROBIHA', 'CEKA', 'REKLAMACE']
const HOTOVE_STAVY = ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA']

export default function ZakazkySeznamClient({ zakazky, orgUsers, zarizeniList, canCreate }: Props) {
  const router = useRouter()
  const [pohled, setPohled] = useState<'aktivni' | 'hotove' | 'vse'>('aktivni')
  const [fStav, setFStav] = useState<string>('')
  const [fTechnik, setFTechnik] = useState<string>('')
  const [fTyp, setFTyp] = useState<string>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const filtered = useMemo(() => {
    return zakazky.filter(z => {
      // Explicitní filtr stavu má přednost před pohledem Aktivní/Hotové.
      if (fStav) {
        if (z.stav !== fStav) return false
      } else {
        if (pohled === 'aktivni' && !AKTIVNI_STAVY.includes(z.stav)) return false
        if (pohled === 'hotove' && !HOTOVE_STAVY.includes(z.stav)) return false
      }
      if (fTechnik && z.technik?.id !== fTechnik) return false
      if (fTyp && z.typ !== fTyp) return false
      return true
    })
  }, [zakazky, pohled, fStav, fTechnik, fTyp])

  const hotoveCount = useMemo(() => zakazky.filter(z => HOTOVE_STAVY.includes(z.stav)).length, [zakazky])

  const filteredZarizeni = zarizeniList.filter(z =>
    !form.zarizeniSearch || `${z.nazev} ${z.klient.jmeno} ${z.klient.prijmeni}`.toLowerCase().includes(form.zarizeniSearch.toLowerCase())
  )

  async function createZakazka() {
    setSaving(true)
    try {
      const planovanyTermin = form.planovanyTermin ? `${form.planovanyTermin}T${form.cas}:00` : null
      const res = await api.post<{ id: string }>('/api/servis/zakazky', {
        typ: form.typ,
        planovanyTermin,
        technikId: form.technikId || null,
        poznamka: form.poznamka || null,
        zarizeniId: form.zarizeniId || null,
        klientId: form.klientId || null,
        kontraktId: form.kontraktId || null,
      }, { errorMessage: 'Servisní zakázku se nepodařilo vytvořit.' })
      if (res.ok && res.data) {
        router.push(`/servis/zakazky/${res.data.id}`)
      } else {
        setSaving(false)
      }
    } catch {
      setSaving(false)
    }
  }

  const inputClass = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'

  const stavFilterOptions = [
    { value: '', label: 'Stav — podle pohledu' },
    ...Object.entries(SERVIS_STAV_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]
  const technikFilterOptions = [
    { value: '', label: 'Všichni technici' },
    ...orgUsers.map(u => ({ value: u.id, label: u.jmeno })),
  ]
  const typFilterOptions = [
    { value: '', label: 'Všechny typy' },
    ...Object.entries(TYP_LABELS).map(([k, v]) => ({ value: k, label: v })),
  ]

  return (
    <>
      {/* Filtry + akce */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {([['aktivni', 'Aktivní', null], ['hotove', 'Hotové', hotoveCount], ['vse', 'Vše', null]] as const).map(([key, label, count]) => (
            <button
              key={key}
              onClick={() => { setPohled(key); setFStav('') }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                pohled === key && !fStav
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {label}
              {count !== null && (
                <span className={`ml-1.5 text-xs font-semibold ${pohled === key && !fStav ? 'text-green-100' : 'text-gray-400 dark:text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <FilterDropdown value={fStav} onChange={setFStav} options={stavFilterOptions} />
        <FilterDropdown value={fTechnik} onChange={setFTechnik} options={technikFilterOptions} />
        <FilterDropdown value={fTyp} onChange={setFTyp} options={typFilterOptions} />
        {canCreate && (
          <button
            onClick={() => { setForm(emptyForm); setModalOpen(true) }}
            className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            + Nová zakázka
          </button>
        )}
      </div>

      {/* Seznam */}
      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">Žádné zakázky odpovídající filtru</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {filtered.map(z => {
              const prosla = jeProsla(z.stav, z.planovanyTermin)
              return (
                <Link
                  key={z.id}
                  href={`/servis/zakazky/${z.id}`}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  {/* Datum */}
                  <div className="flex-shrink-0 w-16 text-center">
                    {z.planovanyTermin ? (
                      <>
                        <p className={`text-lg font-bold leading-none ${prosla ? 'text-red-600 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>
                          {new Date(z.planovanyTermin).getDate()}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(z.planovanyTermin).toLocaleDateString('cs-CZ', { month: 'short' })}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-slate-500">
                          {new Date(z.planovanyTermin).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </>
                    ) : (
                      <span className="text-xs text-gray-400 dark:text-slate-500 italic">bez termínu</span>
                    )}
                  </div>

                  {/* Obsah */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {z.cislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">{z.cislo}</span>}
                      <p className="font-medium text-gray-900 dark:text-white truncate">{z.klientNazev ?? '—'}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {z.predmet && <span className="text-xs text-gray-500 dark:text-slate-400">{z.predmet}</span>}
                      <span className="text-xs text-gray-400 dark:text-slate-500">{typLabel(z.typ)}</span>
                      {z.stav === 'DOKONCENA' && !z.vyfakturovano && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">
                          nevyfakturováno
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Technik + stav */}
                  <div className="flex-shrink-0 flex items-center gap-3">
                    <span className="text-sm text-gray-600 dark:text-slate-400 hidden sm:block">
                      {z.technik ? z.technik.jmeno : <span className="italic text-gray-400 dark:text-slate-500">Nepřiřazen</span>}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(z.stav)}`}>
                      {stavLabel(z.stav)}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Nová zakázka modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nová servisní zakázka</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Zařízení / klient</label>
                <input
                  type="text"
                  value={form.zarizeniSearch}
                  onChange={e => setForm(f => ({ ...f, zarizeniSearch: e.target.value, zarizeniId: '', klientId: '', kontraktId: '' }))}
                  placeholder="Hledat zařízení nebo klienta..."
                  className={`${inputClass} mb-2`}
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
                <select value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value as NavstevaTyp }))} className={inputClass}>
                  {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Datum</label>
                  <input type="date" value={form.planovanyTermin} onChange={e => setForm(f => ({ ...f, planovanyTermin: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Čas</label>
                  <input type="time" value={form.cas} onChange={e => setForm(f => ({ ...f, cas: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500 -mt-2">Bez data vznikne nezaplánovaná zakázka (reaktivní).</p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Technik</label>
                <select value={form.technikId} onChange={e => setForm(f => ({ ...f, technikId: e.target.value }))} className={inputClass}>
                  <option value="">— nepřiřazen —</option>
                  {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Poznámka</label>
                <textarea rows={2} value={form.poznamka} onChange={e => setForm(f => ({ ...f, poznamka: e.target.value }))} placeholder="Volitelná poznámka pro technika..." className={`${inputClass} resize-none`} />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                Zrušit
              </button>
              <button onClick={createZakazka} disabled={saving} className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">
                {saving ? 'Ukládám…' : 'Vytvořit'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
