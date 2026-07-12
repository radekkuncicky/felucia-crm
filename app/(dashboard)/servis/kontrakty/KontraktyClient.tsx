'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { useTableColumns, ColumnDef } from '@/hooks/useTableColumns'
import ColumnConfigButton from '@/components/ColumnConfigButton'
import { ResizeHandle } from '@/components/ResizeHandle'
import ConfirmModal from '@/components/ConfirmModal'
import { type ServisniZakazkaStav, stavLabel, stavColor, jeProsla, jeAktivni } from '@/lib/servisStav'

const KONTR_DEFS: ColumnDef[] = [
  { id: 'cislo', label: 'Číslo', defaultVisible: true, defaultWidth: 110 },
  { id: 'klient', label: 'Klient', defaultVisible: true, defaultWidth: 180 },
  { id: 'zarizeni', label: 'Zařízení', defaultVisible: true, defaultWidth: 150 },
  { id: 'typ', label: 'Typ', defaultVisible: true, defaultWidth: 110 },
  { id: 'pristiServis', label: 'Příští servis', defaultVisible: true, defaultWidth: 120 },
  { id: 'cena', label: 'Cena/rok', defaultVisible: true, defaultWidth: 100 },
  { id: 'stav', label: 'Stav', defaultVisible: true, defaultWidth: 100 },
]


type ServisTyp = 'ROCNI' | 'POLOLETNI' | 'DVOULETNI' | 'JEDNOURAZOVY'
type ZarizeniTyp = 'TEPELNE_CERPADLO' | 'KLIMATIZACE' | 'REKUPERACE' | 'PODLAHOVE_VYTAPENI' | 'VZDUCHOTECHNIKA' | 'OHREV_TV' | 'JINE'
type NavstevaTyp = 'PLANOVANY_SERVIS' | 'PORUCHA' | 'ZARUCNI_OPRAVA' | 'POZARUCNI_OPRAVA' | 'UVEDENI_DO_PROVOZU' | 'KONTROLA'

interface ZarizeniRef {
  id: string
  nazev: string
  typ: ZarizeniTyp
  vyrobniCislo: string | null
}

interface ZarizeniListItem {
  id: string
  nazev: string
  typ: ZarizeniTyp
  vyrobniCislo: string | null
  datumInstalace: string | null
  zarukaDo: string | null
  vytvoreno: string
  klient: { id: string; jmeno: string; prijmeni: string }
}

interface Navsteva {
  id: string
  cislo: string | null
  typ: NavstevaTyp
  planovanyTermin: string
  skutecnyTermin: string | null
  stav: ServisniZakazkaStav
  technikId: string | null
  technik: { id: string; jmeno: string } | null
  poznamka: string | null
  zprava: string | null
  nalezeneZavady: string | null
  doporuceni: string | null
  trvaniMinut: number | null
  nakladyCas: number | null
  nakladyMaterial: number | null
  fotky: string[]
  podpisKlienta: string | null
}

interface Kontrakt {
  id: string
  cisloKontraktu: string | null
  nazev: string
  typ: ServisTyp
  intervalMesicu: number
  cena: string | null
  zacatek: string
  konec: string | null
  aktivni: boolean
  autoRenewal: boolean
  vytvoreno: string
  klient: { id: string; jmeno: string; prijmeni: string }
  zarizeni: ZarizeniRef | null
  deal: { id: string; kod: string | null; predmet: string | null } | null
  servisniZakazky: Navsteva[]
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  kontrakty: Kontrakt[]
  orgUsers: OrgUser[]
  zarizeniList: ZarizeniListItem[]
}

const typLabels: Record<ServisTyp, string> = {
  ROCNI: 'Roční',
  POLOLETNI: 'Pololetní',
  DVOULETNI: 'Dvouletní',
  JEDNOURAZOVY: 'Jednorázový',
}

const navstevaTypLabels: Record<NavstevaTyp, string> = {
  PLANOVANY_SERVIS: 'Plánovaný servis',
  PORUCHA: 'Porucha',
  ZARUCNI_OPRAVA: 'Záruční oprava',
  POZARUCNI_OPRAVA: 'Pozáruční oprava',
  UVEDENI_DO_PROVOZU: 'Uvedení do provozu',
  KONTROLA: 'Kontrola',
}

function getPristiServis(navstevy: Navsteva[]) {
  return navstevy
    .filter(n => n.stav === 'NAPLANOVANA')
    .sort((a, b) => new Date(a.planovanyTermin).getTime() - new Date(b.planovanyTermin).getTime())[0] ?? null
}

function calcProfitability(kontrakt: Kontrakt) {
  const start = new Date(kontrakt.zacatek)
  const now = new Date()
  const monthsActive = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth())
  const cenaRocne = kontrakt.cena ? Number(kontrakt.cena) : 0

  const prijmy = cenaRocne > 0 && kontrakt.intervalMesicu > 0
    ? Math.round((monthsActive / 12) * cenaRocne)
    : 0

  // Náklady ze všech odpracovaných stavů — vyúčtovaná/uzavřená zakázka nesmí
  // z marže zmizet (dřív se počítala jen DOKONCENA).
  const naklady = kontrakt.servisniZakazky
    .filter(n => ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(n.stav))
    .reduce((s, n) => s + (n.nakladyCas ?? 0) + (n.nakladyMaterial ?? 0), 0)

  return { prijmy, naklady, profit: prijmy - naklady }
}

const emptyKontraktForm = {
  zarizeniId: '',
  nazev: '',
  typ: 'ROCNI' as ServisTyp,
  cena: '',
  zacatek: new Date().toISOString().split('T')[0],
  autoRenewal: true,
}

export default function KontraktyClient({ kontrakty, orgUsers, zarizeniList }: Props) {
  const router = useRouter()
  const { data: session } = useSession()
  const userId = session?.user?.id ?? 'anon'
  const { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns } = useTableColumns('kontrakty', userId, KONTR_DEFS)

  const [filter, setFilter] = useState<'vse' | 'aktivni' | 'neaktivni'>('aktivni')
  const [selectedKontrakt, setSelectedKontrakt] = useState<Kontrakt | null>(null)
  const [saving, setSaving] = useState(false)
  const [addNavsteva, setAddNavsteva] = useState(false)
  const [addForm, setAddForm] = useState({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS' as NavstevaTyp, technikId: '', poznamka: '' })
  const [novyKontraktOpen, setNovyKontraktOpen] = useState(false)
  const [novyForm, setNovyForm] = useState(emptyKontraktForm)
  const [zarizeniSearch, setZarizeniSearch] = useState('')
  const [ukoncitKontraktId, setUkoncitKontraktId] = useState<string | null>(null)

  const filtered = kontrakty.filter(k => {
    if (filter === 'aktivni') return k.aktivni
    if (filter === 'neaktivni') return !k.aktivni
    return true
  })

  const filteredZarizeni = zarizeniList.filter(z =>
    !zarizeniSearch || `${z.nazev} ${z.klient.jmeno} ${z.klient.prijmeni} ${z.vyrobniCislo ?? ''}`.toLowerCase().includes(zarizeniSearch.toLowerCase())
  )

  // Dokončování návštěv se z Kontraktů přesunulo do detailu zakázky
  // (/servis/zakazky/[id]) — jedno místo pro protokol, fotky i podpis.
  async function addNavstevaSubmit() {
    if (!selectedKontrakt || !addForm.planovanyTermin) return
    setSaving(true)
    try {
      await fetch(`/api/servis/zakazky/${selectedKontrakt.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planovanyTermin: addForm.planovanyTermin,
          typ: addForm.typ,
          technikId: addForm.technikId || null,
          poznamka: addForm.poznamka || null,
        }),
      })
      setAddNavsteva(false)
      setAddForm({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS', technikId: '', poznamka: '' })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function createKontrakt() {
    if (!novyForm.zarizeniId || !novyForm.nazev) return
    setSaving(true)
    try {
      const z = zarizeniList.find(z => z.id === novyForm.zarizeniId)
      await fetch('/api/servis/kontrakty', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zarizeniId: novyForm.zarizeniId,
          klientId: z?.klient.id,
          nazev: novyForm.nazev,
          typ: novyForm.typ,
          cena: novyForm.cena ? Number(novyForm.cena) : null,
          zacatek: novyForm.zacatek,
          autoRenewal: novyForm.autoRenewal,
        }),
      })
      setNovyKontraktOpen(false)
      setNovyForm(emptyKontraktForm)
      setZarizeniSearch('')
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function ukoncitKontraktConfirm() {
    if (!ukoncitKontraktId) return
    setSaving(true)
    setUkoncitKontraktId(null)
    try {
      await fetch(`/api/servis/kontrakty/${ukoncitKontraktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktivni: false, konec: new Date().toISOString() }),
      })
      setSelectedKontrakt(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  async function obnovitKontrakt(kontraktId: string) {
    setSaving(true)
    try {
      await fetch(`/api/servis/kontrakty/${kontraktId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktivni: true, konec: null }),
      })
      setSelectedKontrakt(null)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <ConfirmModal
        isOpen={ukoncitKontraktId !== null}
        title="Ukončit kontrakt"
        message="Opravdu chcete ukončit tento kontrakt?"
        confirmLabel="Ukončit"
        danger
        onConfirm={ukoncitKontraktConfirm}
        onCancel={() => setUkoncitKontraktId(null)}
      />
      {/* Top bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          {(['aktivni', 'neaktivni', 'vse'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {f === 'aktivni' ? 'Aktivní' : f === 'neaktivni' ? 'Neaktivní' : 'Vše'}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ColumnConfigButton
            columns={columns}
            defs={KONTR_DEFS}
            onToggle={(id, vis) => updateColumn(id, { visible: vis })}
            onReorder={reorderColumns}
            onReset={resetColumns}
          />
          <button
            onClick={() => setNovyKontraktOpen(true)}
            className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors"
          >
            + Nový kontrakt
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">Žádné kontrakty</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: 500 }}>
              <colgroup>
                {visibleColumns.map(col => (
                  <col key={col.id} style={{ width: col.width ?? undefined }} />
                ))}
                <col style={{ width: 80 }} />
              </colgroup>
              <thead className="border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
                <tr>
                  {visibleColumns.map(col => (
                    <th key={col.id} className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase relative select-none">
                      {KONTR_DEFS.find(d => d.id === col.id)?.label}
                      <ResizeHandle onResize={dx => resizeColumn(col.id, dx)} />
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase">Akce</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
                {filtered.map(k => {
                  const pristi = getPristiServis(k.servisniZakazky)
                  const isUrgent = pristi && new Date(pristi.planovanyTermin) <= new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
                  return (
                    <tr key={k.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/30 transition-colors">
                      {visibleColumns.map(col => {
                        switch (col.id) {
                          case 'cislo':
                            return (
                              <td key={col.id} className="px-4 py-3 font-mono text-xs text-gray-500 dark:text-slate-400 overflow-hidden truncate">
                                {k.cisloKontraktu ?? '—'}
                              </td>
                            )
                          case 'klient':
                            return (
                              <td key={col.id} className="px-4 py-3 overflow-hidden">
                                <p className="font-medium text-gray-900 dark:text-white truncate">{k.klient.jmeno} {k.klient.prijmeni}</p>
                                <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{k.nazev}</p>
                              </td>
                            )
                          case 'zarizeni':
                            return (
                              <td key={col.id} className="px-4 py-3 text-gray-600 dark:text-slate-400 overflow-hidden">
                                {k.zarizeni ? <span className="text-sm truncate block">{k.zarizeni.nazev}</span> : <span className="text-gray-400">—</span>}
                              </td>
                            )
                          case 'typ':
                            return <td key={col.id} className="px-4 py-3 text-gray-700 dark:text-slate-300 overflow-hidden truncate">{typLabels[k.typ]}</td>
                          case 'pristiServis':
                            return (
                              <td key={col.id} className="px-4 py-3 overflow-hidden">
                                {pristi ? (
                                  <span className={`text-sm font-medium whitespace-nowrap ${isUrgent ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-slate-300'}`}>
                                    {new Date(pristi.planovanyTermin).toLocaleDateString('cs-CZ')}
                                  </span>
                                ) : <span className="text-gray-400">—</span>}
                              </td>
                            )
                          case 'cena':
                            return (
                              <td key={col.id} className="px-4 py-3 text-gray-700 dark:text-slate-300 overflow-hidden truncate">
                                {k.cena ? `${Number(k.cena).toLocaleString('cs-CZ')} Kč` : '—'}
                              </td>
                            )
                          case 'stav':
                            return (
                              <td key={col.id} className="px-4 py-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${k.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                                  {k.aktivni ? 'Aktivní' : 'Neaktivní'}
                                </span>
                              </td>
                            )
                          default:
                            return <td key={col.id} />
                        }
                      })}
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setSelectedKontrakt(k); setAddNavsteva(false) }}
                          className="text-green-600 dark:text-green-400 hover:underline text-sm font-medium"
                        >
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedKontrakt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {selectedKontrakt.cisloKontraktu && (
                    <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded">
                      {selectedKontrakt.cisloKontraktu}
                    </span>
                  )}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${selectedKontrakt.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                    {selectedKontrakt.aktivni ? 'Aktivní' : 'Neaktivní'}
                  </span>
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">{selectedKontrakt.nazev}</h2>
                <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
                  {selectedKontrakt.klient.jmeno} {selectedKontrakt.klient.prijmeni}
                  {selectedKontrakt.deal && (
                    <>{' · '}<Link href={`/deals/${selectedKontrakt.deal.id}`} className="text-green-600 hover:underline">
                      {selectedKontrakt.deal.kod ?? selectedKontrakt.deal.predmet ?? 'OP'}
                    </Link></>
                  )}
                </p>
              </div>
              <button onClick={() => setSelectedKontrakt(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

            <div className="px-6 py-4 space-y-5">
              {/* Info grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Typ', value: typLabels[selectedKontrakt.typ] },
                  { label: 'Interval', value: selectedKontrakt.intervalMesicu > 0 ? `${selectedKontrakt.intervalMesicu} měs.` : 'Jednorázový' },
                  { label: 'Začátek', value: new Date(selectedKontrakt.zacatek).toLocaleDateString('cs-CZ') },
                  { label: 'Cena/rok', value: selectedKontrakt.cena ? `${Number(selectedKontrakt.cena).toLocaleString('cs-CZ')} Kč` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3">
                    <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">{label}</p>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{value}</p>
                  </div>
                ))}
              </div>

              {/* Zařízení */}
              {selectedKontrakt.zarizeni && (
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-lg px-4 py-3 flex items-center gap-3">
                  <span className="text-xl">⚙️</span>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{selectedKontrakt.zarizeni.nazev}</p>
                    {selectedKontrakt.zarizeni.vyrobniCislo && (
                      <p className="text-xs text-gray-500 dark:text-slate-400">S/N: {selectedKontrakt.zarizeni.vyrobniCislo}</p>
                    )}
                  </div>
                  <Link href="/servis/zarizeni" className="ml-auto text-xs text-green-600 dark:text-green-400 hover:underline">
                    Detail zařízení →
                  </Link>
                </div>
              )}

              {/* Profitability */}
              {selectedKontrakt.cena && (
                <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ziskovost kontraktu</h3>
                  {(() => {
                    const { prijmy, naklady, profit } = calcProfitability(selectedKontrakt)
                    return (
                      <div className="flex gap-4 flex-wrap">
                        <div className="flex-1 min-w-[100px]">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Příjmy (odhadem)</p>
                          <p className="text-lg font-bold text-green-600 dark:text-green-400">{prijmy.toLocaleString('cs-CZ')} Kč</p>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Náklady (výjezdy)</p>
                          <p className="text-lg font-bold text-red-600 dark:text-red-400">{naklady.toLocaleString('cs-CZ')} Kč</p>
                        </div>
                        <div className="flex-1 min-w-[100px]">
                          <p className="text-xs text-gray-500 dark:text-slate-400">Marže</p>
                          <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                            {profit.toLocaleString('cs-CZ')} Kč
                          </p>
                        </div>
                      </div>
                    )
                  })()}
                </div>
              )}

              {/* Visits timeline */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Servisní návštěvy</h3>
                  <button
                    onClick={() => setAddNavsteva(v => !v)}
                    className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium"
                  >
                    + Přidat návštěvu
                  </button>
                </div>

                {addNavsteva && (
                  <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3 border border-green-100 dark:border-green-900/40">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Plánovaný termín</label>
                        <input
                          type="date"
                          value={addForm.planovanyTermin}
                          onChange={e => setAddForm(f => ({ ...f, planovanyTermin: e.target.value }))}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Typ</label>
                        <select
                          value={addForm.typ}
                          onChange={e => setAddForm(f => ({ ...f, typ: e.target.value as NavstevaTyp }))}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          {Object.entries(navstevaTypLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Technik</label>
                        <select
                          value={addForm.technikId}
                          onChange={e => setAddForm(f => ({ ...f, technikId: e.target.value }))}
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        >
                          <option value="">— nepřiřazen —</option>
                          {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Poznámka</label>
                        <input
                          type="text"
                          value={addForm.poznamka}
                          onChange={e => setAddForm(f => ({ ...f, poznamka: e.target.value }))}
                          placeholder="Volitelná poznámka..."
                          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => setAddNavsteva(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">Zrušit</button>
                      <button
                        onClick={addNavstevaSubmit}
                        disabled={!addForm.planovanyTermin || saving}
                        className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                      >
                        Přidat
                      </button>
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  {selectedKontrakt.servisniZakazky.length === 0 && (
                    <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Žádné naplánované návštěvy</p>
                  )}
                  {[...selectedKontrakt.servisniZakazky]
                    .sort((a, b) => new Date(b.planovanyTermin).getTime() - new Date(a.planovanyTermin).getTime())
                    .map((n: Navsteva) => (
                    <div key={n.id} className={`p-3 rounded-lg border ${
                      n.stav === 'DOKONCENA' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                      n.stav === 'ZRUSENA' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                      jeProsla(n.stav, n.planovanyTermin) ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' :
                      'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30'
                    }`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            {n.cislo && (
                              <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{n.cislo}</span>
                            )}
                            <span className="text-sm font-medium text-gray-900 dark:text-white">
                              {new Date(n.planovanyTermin).toLocaleDateString('cs-CZ')}
                            </span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(n.stav)}`}>
                              {stavLabel(n.stav)}
                            </span>
                            <span className="text-xs text-gray-500 dark:text-slate-400">{navstevaTypLabels[n.typ]}</span>
                            {n.technik && (
                              <span className="text-xs text-gray-500 dark:text-slate-400">· {n.technik.jmeno}</span>
                            )}
                          </div>
                          {n.zprava && <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">{n.zprava}</p>}
                          {n.nalezeneZavady && <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5">⚠ {n.nalezeneZavady}</p>}
                          {n.doporuceni && <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">💡 {n.doporuceni}</p>}
                          {(n.nakladyCas || n.nakladyMaterial) && (
                            <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                              Náklady: {[(n.nakladyCas ? `čas ${n.nakladyCas.toLocaleString('cs-CZ')} Kč` : null), (n.nakladyMaterial ? `mat. ${n.nakladyMaterial.toLocaleString('cs-CZ')} Kč` : null)].filter(Boolean).join(' + ')}
                            </p>
                          )}
                          {n.skutecnyTermin && (
                            <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                              Uskutečněno: {new Date(n.skutecnyTermin).toLocaleDateString('cs-CZ')}
                              {n.trvaniMinut ? ` · ${n.trvaniMinut} min` : ''}
                              {n.podpisKlienta ? ' · ✓ podpis' : ''}
                            </p>
                          )}
                          {n.fotky.length > 0 && (
                            <div className="flex gap-1.5 mt-2 flex-wrap">
                              {n.fotky.map((foto, idx) => (
                                <img key={idx} src={foto} alt={`Foto ${idx + 1}`}
                                  className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-slate-600 cursor-pointer"
                                  onClick={() => window.open(foto)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        <Link
                          href={`/servis/zakazky/${n.id}`}
                          className="flex-shrink-0 text-xs text-green-600 dark:text-green-400 hover:underline font-medium whitespace-nowrap"
                        >
                          {jeAktivni(n.stav) ? 'Otevřít zakázku →' : 'Detail →'}
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
                {selectedKontrakt.aktivni ? (
                  <button
                    onClick={() => setUkoncitKontraktId(selectedKontrakt.id)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
                  >
                    Ukončit kontrakt
                  </button>
                ) : (
                  <button
                    onClick={() => obnovitKontrakt(selectedKontrakt.id)}
                    disabled={saving}
                    className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50"
                  >
                    Obnovit kontrakt
                  </button>
                )}
                <button
                  onClick={() => setAddNavsteva(true)}
                  className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
                >
                  + Přidat návštěvu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Nový kontrakt modal */}
      {novyKontraktOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Nový servisní kontrakt</h3>
              <button onClick={() => setNovyKontraktOpen(false)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="px-6 py-4 space-y-4">
              {/* Zařízení search */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Zařízení *</label>
                <input
                  type="text"
                  value={zarizeniSearch}
                  onChange={e => { setZarizeniSearch(e.target.value); setNovyForm(f => ({ ...f, zarizeniId: '' })) }}
                  placeholder="Hledat zařízení nebo klienta..."
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 mb-2"
                />
                {zarizeniSearch && !novyForm.zarizeniId && (
                  <div className="border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden max-h-48 overflow-y-auto">
                    {filteredZarizeni.length === 0 ? (
                      <p className="px-3 py-2 text-sm text-gray-500 dark:text-slate-400">Žádné zařízení nenalezeno</p>
                    ) : filteredZarizeni.slice(0, 8).map(z => (
                      <button
                        key={z.id}
                        onClick={() => { setNovyForm(f => ({ ...f, zarizeniId: z.id, nazev: z.nazev + ' – servis' })); setZarizeniSearch(`${z.nazev} (${z.klient.jmeno} ${z.klient.prijmeni})`) }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 dark:hover:bg-slate-700 border-b border-gray-100 dark:border-slate-700 last:border-0"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{z.nazev}</span>
                        <span className="text-gray-500 dark:text-slate-400"> · {z.klient.jmeno} {z.klient.prijmeni}</span>
                        {z.vyrobniCislo && <span className="text-xs text-gray-400 dark:text-slate-500"> · S/N {z.vyrobniCislo}</span>}
                      </button>
                    ))}
                  </div>
                )}
                {novyForm.zarizeniId && (
                  <p className="text-xs text-green-600 dark:text-green-400">✓ Zařízení vybráno</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Název kontraktu *</label>
                <input
                  type="text"
                  value={novyForm.nazev}
                  onChange={e => setNovyForm(f => ({ ...f, nazev: e.target.value }))}
                  placeholder="napr. Roční servis TČ"
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Typ</label>
                  <select
                    value={novyForm.typ}
                    onChange={e => setNovyForm(f => ({ ...f, typ: e.target.value as ServisTyp }))}
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    {Object.entries(typLabels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Cena/rok (Kč)</label>
                  <input
                    type="number"
                    min="0"
                    value={novyForm.cena}
                    onChange={e => setNovyForm(f => ({ ...f, cena: e.target.value }))}
                    placeholder="napr. 3500"
                    className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1">Začátek</label>
                <input
                  type="date"
                  value={novyForm.zacatek}
                  onChange={e => setNovyForm(f => ({ ...f, zacatek: e.target.value }))}
                  className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={novyForm.autoRenewal}
                  onChange={e => setNovyForm(f => ({ ...f, autoRenewal: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm text-gray-700 dark:text-slate-300">Automatické obnovení</span>
              </label>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-700 flex gap-3 justify-end">
              <button
                onClick={() => { setNovyKontraktOpen(false); setNovyForm(emptyKontraktForm); setZarizeniSearch('') }}
                className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 border border-gray-300 dark:border-slate-600 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700"
              >
                Zrušit
              </button>
              <button
                onClick={createKontrakt}
                disabled={!novyForm.zarizeniId || !novyForm.nazev || saving}
                className="px-5 py-2 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
              >
                {saving ? 'Vytvářím…' : 'Vytvořit kontrakt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
