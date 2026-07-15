'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { type ServisniZakazkaStav, stavLabel, stavColor, jeProsla } from '@/lib/servisStav'
import { formatDate, formatKcPresne } from '@/lib/format'
import { IconCog, IconClipboard, IconWarning } from '@/components/ui/Icons'

type ServisTyp = 'ROCNI' | 'POLOLETNI' | 'DVOULETNI' | 'JEDNOURAZOVY'
type NavstevaTyp = 'PLANOVANY_SERVIS' | 'PORUCHA' | 'ZARUCNI_OPRAVA' | 'POZARUCNI_OPRAVA' | 'UVEDENI_DO_PROVOZU' | 'KONTROLA'
type ZarizeniTyp = 'TEPELNE_CERPADLO' | 'KLIMATIZACE' | 'REKUPERACE' | 'PODLAHOVE_VYTAPENI' | 'VZDUCHOTECHNIKA' | 'OHREV_TV' | 'JINE'

interface ZarizeniItem {
  id: string
  nazev: string
  typ: ZarizeniTyp
  vyrobniCislo: string | null
  datumInstalace: string | null
  zarukaDo: string | null
}

interface Navsteva {
  id: string
  cislo: string | null
  typ: NavstevaTyp
  planovanyTermin: string
  skutecnyTermin: string | null
  stav: ServisniZakazkaStav
  zprava: string | null
  nalezeneZavady: string | null
  trvaniMinut: number | null
  technik: { id: string; jmeno: string } | null
}

interface Kontrakt {
  id: string
  nazev: string
  typ: ServisTyp
  intervalMesicu: number
  cena: string | null
  zacatek: string
  konec: string | null
  aktivni: boolean
  zarizeni: ZarizeniItem | null
  servisniZakazky: Navsteva[]
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  zarizeni: ZarizeniItem[]
  kontrakty: Kontrakt[]
  orgUsers: OrgUser[]
  dealId?: string
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

function zarizeniTypLabel(typ: ZarizeniTyp) {
  const m: Record<ZarizeniTyp, string> = {
    TEPELNE_CERPADLO: 'Tepelné čerpadlo',
    KLIMATIZACE: 'Klimatizace',
    REKUPERACE: 'Rekuperace',
    PODLAHOVE_VYTAPENI: 'Podlahové vytápění',
    VZDUCHOTECHNIKA: 'Vzduchotechnika',
    OHREV_TV: 'Ohřev TUV',
    JINE: 'Jiné',
  }
  return m[typ] ?? typ
}

function warrantyStatus(zarukaDo: string | null) {
  if (!zarukaDo) return null
  const d = new Date(zarukaDo)
  const now = new Date()
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diff < 0) return { label: 'Záruka expirovala', cls: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' }
  if (diff < 90) return { label: `Záruka do ${formatDate(d)}`, cls: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' }
  return { label: `Záruka do ${formatDate(d)}`, cls: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' }
}

export default function ServisTab({ zarizeni, kontrakty, orgUsers }: Props) {
  const router = useRouter()
  const [addNavsteva, setAddNavsteva] = useState<string | null>(null)
  const [addForm, setAddForm] = useState({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS' as NavstevaTyp, technikId: '' })
  const [saving, setSaving] = useState(false)

  const aktivniKontrakt = kontrakty.find(k => k.aktivni) ?? null
  const vsechnyNavstevy = kontrakty.flatMap(k => k.servisniZakazky)
  const pristiNavsteva = vsechnyNavstevy
    .filter(n => n.stav === 'NAPLANOVANA')
    .sort((a, b) => new Date(a.planovanyTermin).getTime() - new Date(b.planovanyTermin).getTime())[0] ?? null
  const posledniNavstevy = [...vsechnyNavstevy]
    .filter(n => n.stav === 'DOKONCENA')
    .sort((a, b) => new Date(b.planovanyTermin).getTime() - new Date(a.planovanyTermin).getTime())
    .slice(0, 5)

  async function addNavstevaSubmit(kontraktId: string) {
    if (!addForm.planovanyTermin) return
    setSaving(true)
    try {
      await fetch(`/api/servis/zakazky/${kontraktId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planovanyTermin: addForm.planovanyTermin,
          typ: addForm.typ,
          technikId: addForm.technikId || null,
        }),
      })
      setAddNavsteva(null)
      setAddForm({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS', technikId: '' })
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Zařízení */}
      {zarizeni.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <IconCog className="w-5 h-5 text-gray-500 dark:text-slate-400" /> Zařízení
          </h3>
          <div className="space-y-3">
            {zarizeni.map(z => {
              const ws = warrantyStatus(z.zarukaDo)
              return (
                <div key={z.id} className="flex items-start justify-between gap-4 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white">{z.nazev}</p>
                    <div className="flex flex-wrap gap-2 mt-1">
                      <span className="text-xs text-gray-500 dark:text-slate-400">{zarizeniTypLabel(z.typ)}</span>
                      {z.vyrobniCislo && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">S/N: {z.vyrobniCislo}</span>
                      )}
                      {z.datumInstalace && (
                        <span className="text-xs text-gray-500 dark:text-slate-400">
                          Instalace: {formatDate(z.datumInstalace)}
                        </span>
                      )}
                    </div>
                    {ws && (
                      <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${ws.cls}`}>
                        {ws.label}
                      </span>
                    )}
                  </div>
                  <Link
                    href="/servis/zarizeni"
                    className="flex-shrink-0 text-xs text-primary dark:text-primary-light hover:underline"
                  >
                    Detail →
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Active kontrakt summary */}
      {aktivniKontrakt && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <IconClipboard className="w-5 h-5 text-gray-500 dark:text-slate-400" /> Aktivní kontrakt
              </h3>
              <p className="text-sm text-gray-600 dark:text-slate-400 mt-0.5">{aktivniKontrakt.nazev}</p>
            </div>
            <Link
              href="/servis/kontrakty"
              className="flex-shrink-0 text-xs text-primary dark:text-primary-light hover:underline"
            >
              Spravovat →
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Typ', value: typLabels[aktivniKontrakt.typ] },
              { label: 'Interval', value: aktivniKontrakt.intervalMesicu > 0 ? `${aktivniKontrakt.intervalMesicu} měs.` : 'Jednorázový' },
              { label: 'Cena/rok', value: aktivniKontrakt.cena ? `${formatKcPresne(Number(aktivniKontrakt.cena))}` : '—' },
              { label: 'Platí od', value: formatDate(aktivniKontrakt.zacatek) },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-slate-900/50 rounded-lg p-2.5">
                <p className="text-xs text-gray-500 dark:text-slate-400">{label}</p>
                <p className="font-medium text-gray-900 dark:text-white text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Next visit */}
          {pristiNavsteva && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-900/40 rounded-lg px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase mb-0.5">Příští servis</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {new Date(pristiNavsteva.planovanyTermin).toLocaleDateString('cs-CZ', { weekday: 'long', day: 'numeric', month: 'long' })}
                </p>
                {pristiNavsteva.technik && (
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Technik: {pristiNavsteva.technik.jmeno}</p>
                )}
              </div>
              <span className={`text-xs px-2 py-1 rounded-full font-medium ${stavColor(pristiNavsteva.stav)}`}>
                {stavLabel(pristiNavsteva.stav)}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Last 5 visits */}
      {posledniNavstevy.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-3">Posledních 5 dokončených návštěv</h3>
          <div className="space-y-2">
            {posledniNavstevy.map(n => (
              <div key={n.id} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-slate-900/50 rounded-lg">
                <div className="flex-shrink-0 mt-0.5">
                  <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <span className="text-sm">✓</span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(n.planovanyTermin)}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-slate-400">{navstevaTypLabels[n.typ]}</span>
                    {n.technik && <span className="text-xs text-gray-500 dark:text-slate-400">· {n.technik.jmeno}</span>}
                    {n.trvaniMinut && <span className="text-xs text-gray-400 dark:text-slate-500">· {n.trvaniMinut} min</span>}
                  </div>
                  {n.zprava && <p className="text-xs text-gray-600 dark:text-slate-400 mt-0.5 line-clamp-2">{n.zprava}</p>}
                  {n.nalezeneZavady && <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5 flex items-start gap-1"><IconWarning className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {n.nalezeneZavady}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Kontrakty with add visit */}
      {kontrakty.map(k => (
        <div key={k.id} className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="px-5 py-4 bg-gray-50 dark:bg-slate-900/50 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">{k.nazev}</h3>
              <p className="text-sm text-gray-500 dark:text-slate-400">
                {typLabels[k.typ]} · {k.intervalMesicu > 0 ? `každých ${k.intervalMesicu} měsíců` : 'jednorázový'}
                {k.cena ? ` · ${formatKcPresne(Number(k.cena))}/rok` : ''}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.aktivni ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'}`}>
                {k.aktivni ? 'Aktivní' : 'Neaktivní'}
              </span>
              <button
                onClick={() => { setAddNavsteva(k.id); setAddForm({ planovanyTermin: '', typ: 'PLANOVANY_SERVIS', technikId: '' }) }}
                className="text-xs text-green-600 dark:text-green-400 hover:underline font-medium"
              >
                + Nový servis
              </button>
            </div>
          </div>

          <div className="px-5 py-4">
            {addNavsteva === k.id && (
              <div className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg space-y-3 border border-green-100 dark:border-green-900/40">
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Termín</label>
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
                </div>
                <div className="flex gap-2 justify-end">
                  <button onClick={() => setAddNavsteva(null)} className="text-sm text-gray-500 hover:text-gray-700 dark:text-slate-400 dark:hover:text-slate-200">Zrušit</button>
                  <button
                    onClick={() => addNavstevaSubmit(k.id)}
                    disabled={!addForm.planovanyTermin || saving}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                  >
                    Přidat
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              {k.servisniZakazky.length === 0 && (
                <p className="text-sm text-gray-500 dark:text-slate-400 py-2">Žádné návštěvy</p>
              )}
              {k.servisniZakazky
                .sort((a, b) => new Date(b.planovanyTermin).getTime() - new Date(a.planovanyTermin).getTime())
                .slice(0, 8)
                .map(n => (
                <div key={n.id} className={`flex items-start justify-between p-3 rounded-lg border ${
                  n.stav === 'DOKONCENA' ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20' :
                  n.stav === 'ZRUSENA' ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20' :
                  jeProsla(n.stav, n.planovanyTermin) ? 'border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20' :
                  'border-gray-200 dark:border-slate-700'
                }`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {n.cislo && <span className="font-mono text-xs text-gray-400 dark:text-slate-500">{n.cislo}</span>}
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatDate(n.planovanyTermin)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${stavColor(n.stav)}`}>
                        {stavLabel(n.stav)}
                      </span>
                      <span className="text-xs text-gray-500 dark:text-slate-400">{navstevaTypLabels[n.typ]}</span>
                      {n.technik && <span className="text-xs text-gray-500 dark:text-slate-400">· {n.technik.jmeno}</span>}
                    </div>
                    {n.zprava && <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 line-clamp-2">{n.zprava}</p>}
                    {n.nalezeneZavady && <p className="text-xs text-orange-700 dark:text-orange-400 mt-0.5 flex items-start gap-1"><IconWarning className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> {n.nalezeneZavady}</p>}
                  </div>
                  {n.stav === 'DOKONCENA' && (
                    <a
                      href={`/api/servis/zakazky/${n.id}/protokol`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 ml-3 text-xs text-green-700 dark:text-green-400 hover:underline font-medium whitespace-nowrap"
                      title="Stáhnout servisní protokol PDF"
                    >
                      ⬇ Protokol
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}

      {/* Empty state */}
      {kontrakty.length === 0 && zarizeni.length === 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-10 text-center">
          <IconCog className="w-10 h-10 mx-auto mb-3 text-gray-300 dark:text-slate-600" />
          <p className="text-gray-700 dark:text-slate-300 font-medium mb-1">Zatím žádný servis</p>
          <p className="text-sm text-gray-500 dark:text-slate-400">K tomuto OP není přiřazeno zařízení ani servisní kontrakt.</p>
          <Link href="/servis/kontrakty" className="inline-block mt-4 text-sm text-green-600 dark:text-green-400 hover:underline font-medium">
            Spravovat kontrakty →
          </Link>
        </div>
      )}
    </div>
  )
}
