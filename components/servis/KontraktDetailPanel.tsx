'use client'

import { useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import ConfirmModal from '@/components/ConfirmModal'
import { stavLabel, stavColor, jeProsla, jeAktivni, typLabel, TYP_LABELS, type NavstevaTyp } from '@/lib/servisStav'
import { IconCog, IconWarning, IconLightbulb } from '@/components/ui/Icons'
import { formatDate, formatKcPresne, formatCislo } from '@/lib/format'
import { SERVIS_TYP_LABELS, type Kontrakt, type NavstevaRef, type OrgUser } from './types'

interface Props {
  kontrakt: Kontrakt
  orgUsers: OrgUser[]
  onClose: () => void
  /** Po změně (návštěva přidána, kontrakt ukončen/obnoven) — volající typicky router.refresh(). */
  onChanged: () => void
}

// Ziskovost: příjmy odhadem (cena/rok × odběhlé měsíce), náklady ze všech
// odpracovaných stavů — vyúčtovaná/uzavřená zakázka nesmí z marže zmizet.
function calcProfitability(kontrakt: Kontrakt) {
  const start = new Date(kontrakt.zacatek)
  const now = new Date()
  const monthsActive = Math.max(0, (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth())
  const cenaRocne = kontrakt.cena ? Number(kontrakt.cena) : 0
  const prijmy = cenaRocne > 0 && kontrakt.intervalMesicu > 0 ? Math.round((monthsActive / 12) * cenaRocne) : 0
  const naklady = kontrakt.servisniZakazky
    .filter(n => ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(n.stav))
    .reduce((s, n) => s + (n.nakladyCas ?? 0) + (n.nakladyMaterial ?? 0), 0)
  return { prijmy, naklady, profit: prijmy - naklady }
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500'
const lbl = 'block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1'

// Detail kontraktu (přeneseno ze /servis/kontrakty): dlaždice, ziskovost,
// timeline návštěv s prolinkem do zakázky, „přidat návštěvu", ukončit/obnovit.
// Dokončování návštěv patří do detailu zakázky (protokol, fotky, podpis).
export default function KontraktDetailPanel({ kontrakt, orgUsers, onClose, onChanged }: Props) {
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addForm, setAddForm] = useState({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS' as NavstevaTyp, technikId: '', poznamka: '' })
  const [ukoncitOpen, setUkoncitOpen] = useState(false)

  async function addNavsteva() {
    if (!addForm.planovanyTermin) return
    setSaving(true)
    try {
      const res = await api.post(`/api/servis/zakazky/${kontrakt.id}`, {
        planovanyTermin: addForm.planovanyTermin,
        typ: addForm.typ,
        technikId: addForm.technikId || null,
        poznamka: addForm.poznamka || null,
      }, { errorMessage: 'Návštěvu se nepodařilo naplánovat.' })
      if (res.ok) {
        setAddOpen(false)
        setAddForm({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS', technikId: '', poznamka: '' })
        onChanged()
      }
    } finally {
      setSaving(false)
    }
  }

  async function setAktivni(aktivni: boolean) {
    setSaving(true)
    setUkoncitOpen(false)
    try {
      const res = await api.patch(`/api/servis/kontrakty/${kontrakt.id}`,
        aktivni ? { aktivni: true, konec: null } : { aktivni: false, konec: new Date().toISOString() },
        { errorMessage: aktivni ? 'Kontrakt se nepodařilo obnovit.' : 'Kontrakt se nepodařilo ukončit.' })
      if (res.ok) { onChanged(); onClose() }
    } finally {
      setSaving(false)
    }
  }

  const navstevy = [...kontrakt.servisniZakazky].sort((a, b) => (b.planovanyTermin ?? '').localeCompare(a.planovanyTermin ?? ''))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <ConfirmModal
        isOpen={ukoncitOpen}
        title="Ukončit kontrakt"
        message="Opravdu chcete ukončit tento kontrakt? Budoucí naplánované návštěvy zůstanou — zruš je ručně, pokud už nemají proběhnout."
        confirmLabel="Ukončit"
        danger
        onConfirm={() => setAktivni(false)}
        onCancel={() => setUkoncitOpen(false)}
      />
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-700 flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {kontrakt.cisloKontraktu && (
                <span className="font-mono text-xs bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded">{kontrakt.cisloKontraktu}</span>
              )}
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kontrakt.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                {kontrakt.aktivni ? 'Aktivní' : 'Neaktivní'}
              </span>
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">{kontrakt.nazev}</h2>
            <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
              <Link href={`/clients/${kontrakt.klient.id}`} className="hover:underline">{kontrakt.klient.jmeno} {kontrakt.klient.prijmeni}</Link>
              {kontrakt.deal && (
                <>{' · '}<Link href={`/deals/${kontrakt.deal.id}`} className="text-green-600 hover:underline">{kontrakt.deal.kod ?? kontrakt.deal.predmet ?? 'OP'}</Link></>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="px-6 py-4 space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Typ', value: SERVIS_TYP_LABELS[kontrakt.typ] },
              { label: 'Interval', value: kontrakt.intervalMesicu > 0 ? `${kontrakt.intervalMesicu} měs.` : 'Jednorázový' },
              { label: 'Začátek', value: formatDate(kontrakt.zacatek) },
              { label: 'Cena/rok', value: kontrakt.cena ? formatKcPresne(Number(kontrakt.cena)) : '—' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase mb-1">{label}</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{value}</p>
              </div>
            ))}
          </div>

          {kontrakt.zarizeni && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/40 rounded-lg px-4 py-3 flex items-center gap-3">
              <IconCog className="w-6 h-6 text-green-600 dark:text-green-400" />
              <div>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{kontrakt.zarizeni.nazev}</p>
                {kontrakt.zarizeni.vyrobniCislo && <p className="text-xs text-gray-500 dark:text-slate-400">S/N: {kontrakt.zarizeni.vyrobniCislo}</p>}
              </div>
            </div>
          )}

          {kontrakt.cena && (() => {
            const { prijmy, naklady, profit } = calcProfitability(kontrakt)
            return (
              <div className="border border-gray-200 dark:border-slate-700 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-3">Ziskovost kontraktu</h3>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Příjmy (odhadem)</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCislo(prijmy)} Kč</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Náklady (výjezdy)</p>
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">{formatCislo(naklady)} Kč</p>
                  </div>
                  <div className="flex-1 min-w-[100px]">
                    <p className="text-xs text-gray-500 dark:text-slate-400">Marže</p>
                    <p className={`text-lg font-bold ${profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>{formatCislo(profit)} Kč</p>
                  </div>
                </div>
              </div>
            )
          })()}

          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white">Servisní návštěvy</h3>
              <button onClick={() => setAddOpen(v => !v)} className="text-sm text-green-600 dark:text-green-400 hover:underline font-medium">+ Přidat návštěvu</button>
            </div>

            {addOpen && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3 border border-green-100 dark:border-green-900/40">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Plánovaný termín</label>
                    <input type="date" value={addForm.planovanyTermin} onChange={e => setAddForm(f => ({ ...f, planovanyTermin: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Typ</label>
                    <select value={addForm.typ} onChange={e => setAddForm(f => ({ ...f, typ: e.target.value as NavstevaTyp }))} className={inp}>
                      {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Technik</label>
                    <select value={addForm.technikId} onChange={e => setAddForm(f => ({ ...f, technikId: e.target.value }))} className={inp}>
                      <option value="">— nepřiřazen —</option>
                      {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className={lbl}>Poznámka</label>
                    <input type="text" value={addForm.poznamka} onChange={e => setAddForm(f => ({ ...f, poznamka: e.target.value }))} placeholder="Volitelná poznámka…" className={inp} />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddOpen(false)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">Zrušit</button>
                  <button onClick={addNavsteva} disabled={!addForm.planovanyTermin || saving} className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50">Přidat</button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {navstevy.length === 0 && <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-4">Žádné naplánované návštěvy</p>}
              {navstevy.map((n: NavstevaRef) => (
                <div key={n.id} className={`p-3 rounded-lg border ${
                  ['DOKONCENA', 'VYUCTOVANA', 'UZAVRENA'].includes(n.stav) ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                  n.stav === 'ZRUSENA' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                  jeProsla(n.stav, n.planovanyTermin) ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' :
                  'border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/30'
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        {n.cislo && <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{n.cislo}</span>}
                        <span className="text-sm font-medium text-gray-900 dark:text-white">{n.planovanyTermin ? formatDate(n.planovanyTermin) : 'bez termínu'}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(n.stav)}`}>{stavLabel(n.stav)}</span>
                        <span className="text-xs text-gray-500 dark:text-slate-400">{typLabel(n.typ)}</span>
                        {n.technik && <span className="text-xs text-gray-500 dark:text-slate-400">· {n.technik.jmeno}</span>}
                      </div>
                      {n.popis && <p className="text-xs text-gray-700 dark:text-slate-300">{n.popis}</p>}
                      {n.zprava && <p className="text-xs text-gray-700 dark:text-slate-300 mt-1">{n.zprava}</p>}
                      {n.nalezeneZavady && <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5 flex items-start gap-1"><IconWarning className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {n.nalezeneZavady}</p>}
                      {n.doporuceni && <p className="text-xs text-green-700 dark:text-green-400 mt-0.5 flex items-start gap-1"><IconLightbulb className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {n.doporuceni}</p>}
                      {(n.nakladyCas || n.nakladyMaterial) && (
                        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                          Náklady: {[n.nakladyCas ? `čas ${formatKcPresne(n.nakladyCas)}` : null, n.nakladyMaterial ? `mat. ${formatKcPresne(n.nakladyMaterial)}` : null].filter(Boolean).join(' + ')}
                        </p>
                      )}
                      {n.skutecnyTermin && (
                        <p className="text-xs text-gray-500 dark:text-slate-500 mt-0.5">
                          Uskutečněno: {formatDate(n.skutecnyTermin)}{n.trvaniMinut ? ` · ${n.trvaniMinut} min` : ''}{n.podpisKlienta ? ' · ✓ podpis' : ''}
                        </p>
                      )}
                    </div>
                    <Link href={`/servis/zakazky/${n.id}`} className="flex-shrink-0 text-xs text-green-600 dark:text-green-400 hover:underline font-medium whitespace-nowrap">
                      {jeAktivni(n.stav) ? 'Otevřít zakázku →' : 'Detail →'}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-gray-200 dark:border-slate-700">
            {kontrakt.aktivni ? (
              <button onClick={() => setUkoncitOpen(true)} disabled={saving} className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50">Ukončit kontrakt</button>
            ) : (
              <button onClick={() => setAktivni(true)} disabled={saving} className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg disabled:opacity-50">Obnovit kontrakt</button>
            )}
            <button onClick={() => setAddOpen(true)} className="px-4 py-2 text-sm font-medium text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">+ Přidat návštěvu</button>
          </div>
        </div>
      </div>
    </div>
  )
}
