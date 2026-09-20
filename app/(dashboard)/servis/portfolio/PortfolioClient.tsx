'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/format'
import { ZARIZENI_TYP_LABEL } from '@/lib/calendarEvents'
import { stavLabel, stavColor, jeProsla, jeAktivni, typLabel } from '@/lib/servisStav'
import type { Client } from '@/components/ClientSelectWithCreate'
import QrModal from '@/components/servis/QrModal'
import NoveZarizeniModal from '@/components/servis/NoveZarizeniModal'
import NovyKontraktModal from '@/components/servis/NovyKontraktModal'
import KontraktDetailPanel from '@/components/servis/KontraktDetailPanel'
import {
  SERVIS_TYP_LABELS,
  pristiNavsteva,
  posledniDokoncena,
  zarukaStav,
  type Kontrakt,
  type NavstevaRef,
  type OrgUser,
  type Zarizeni,
} from '@/components/servis/types'

interface KlientSkupina {
  klient: { id: string; jmeno: string; prijmeni: string; telefon: string | null; adresa: string | null }
  zarizeni: Zarizeni[]
  kontraktyBezZarizeni: Kontrakt[]
  zakazkyBezZarizeni: NavstevaRef[]
}

interface Props {
  klienti: KlientSkupina[]
  clients: Client[]
  orgUsers: OrgUser[]
  canManage: boolean
  focusKlientId: string | null
}

type Filtr = 'vse' | 'kontrakt' | 'bez-kontraktu' | 'zaruka'

const FILTRY: { key: Filtr; label: string; title: string }[] = [
  { key: 'vse', label: 'Vše', title: 'Všichni klienti se zařízením, smlouvou nebo servisní akcí' },
  { key: 'kontrakt', label: 'S aktivní smlouvou', title: 'Klienti s alespoň jedním aktivním kontraktem' },
  { key: 'bez-kontraktu', label: 'Bez smlouvy', title: 'Zařízení bez aktivního kontraktu — příležitost k prodeji servisu' },
  { key: 'zaruka', label: 'Záruka končí', title: 'Záruka zařízení vyprší do 90 dní nebo už vypršela' },
]

function maAktivniKontrakt(s: KlientSkupina) {
  return s.zarizeni.some(z => z.kontrakty.some(k => k.aktivni)) || s.kontraktyBezZarizeni.some(k => k.aktivni)
}
function maZarizeniBezKontraktu(s: KlientSkupina) {
  return s.zarizeni.some(z => z.aktivni && !z.kontrakty.some(k => k.aktivni))
}
function maKonciciZaruku(s: KlientSkupina) {
  return s.zarizeni.some(z => z.aktivni && zarukaStav(z.zarukaDo) !== 'ok' && zarukaStav(z.zarukaDo) !== null)
}

/** Nejbližší naplánovaná návštěva přes všechna zařízení a smlouvy klienta. */
function pristiKlienta(s: KlientSkupina): NavstevaRef | null {
  const vse = [
    ...s.zarizeni.flatMap(z => z.zakazky),
    ...s.kontraktyBezZarizeni.flatMap(k => k.servisniZakazky),
    ...s.zakazkyBezZarizeni,
  ]
  return pristiNavsteva(vse)
}

function otevrenychKlienta(s: KlientSkupina): number {
  const ids = new Set<string>()
  for (const n of [...s.zarizeni.flatMap(z => z.zakazky), ...s.kontraktyBezZarizeni.flatMap(k => k.servisniZakazky), ...s.zakazkyBezZarizeni]) {
    if (jeAktivni(n.stav) || n.stav === 'REKLAMACE') ids.add(n.id)
  }
  return ids.size
}

function ZarukaBadge({ zarukaDo }: { zarukaDo: string | null }) {
  const st = zarukaStav(zarukaDo)
  if (!st) return null
  const cls =
    st === 'vyprsela' ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
    : st === 'konci' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300'
    : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${cls}`}>
      {st === 'vyprsela' ? 'záruka vypršela' : st === 'konci' ? `záruka do ${formatDate(zarukaDo!)}` : `záruka do ${formatDate(zarukaDo!)}`}
    </span>
  )
}

function NavstevaRadek({ n, prefix }: { n: NavstevaRef; prefix?: string }) {
  const prosla = jeProsla(n.stav, n.planovanyTermin)
  return (
    <Link href={`/servis/zakazky/${n.id}`} className="flex items-center gap-2 text-xs hover:underline min-w-0">
      {prefix && <span className="text-gray-400 dark:text-slate-500 flex-shrink-0">{prefix}</span>}
      <span className={`font-medium flex-shrink-0 ${prosla ? 'text-red-600 dark:text-red-400' : 'text-gray-800 dark:text-slate-200'}`}>
        {n.skutecnyTermin ? formatDate(n.skutecnyTermin) : n.planovanyTermin ? formatDate(n.planovanyTermin) : 'bez termínu'}
      </span>
      <span className={`px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${stavColor(n.stav)}`}>{stavLabel(n.stav)}</span>
      <span className="text-gray-500 dark:text-slate-400 truncate">{n.popis ?? typLabel(n.typ)}{n.technik ? ` · ${n.technik.jmeno}` : ''}</span>
    </Link>
  )
}

export default function PortfolioClient({ klienti, clients, orgUsers, canManage, focusKlientId }: Props) {
  const router = useRouter()
  const [hledat, setHledat] = useState('')
  const [filtr, setFiltr] = useState<Filtr>('vse')
  const [otevrene, setOtevrene] = useState<Set<string>>(() => new Set(focusKlientId ? [focusKlientId] : []))
  const [qr, setQr] = useState<Zarizeni | null>(null)
  const [noveZarizeniPro, setNoveZarizeniPro] = useState<string | null | 'any'>(null)
  const [novyKontraktPro, setNovyKontraktPro] = useState<string | null | 'any'>(null)
  // Držíme jen id — po router.refresh() se panel překreslí z nových props (přidaná návštěva se hned ukáže).
  const [detailKontraktId, setDetailKontraktId] = useState<string | null>(null)
  const detailKontrakt = useMemo<Kontrakt | null>(() => {
    if (!detailKontraktId) return null
    for (const s of klienti) {
      for (const z of s.zarizeni) { const k = z.kontrakty.find(k => k.id === detailKontraktId); if (k) return k }
      const k = s.kontraktyBezZarizeni.find(k => k.id === detailKontraktId); if (k) return k
    }
    return null
  }, [klienti, detailKontraktId])
  const focusRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (focusKlientId && focusRef.current) focusRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [focusKlientId])

  const zarizeniList = useMemo(
    () => klienti.flatMap(s => s.zarizeni.filter(z => z.aktivni).map(z => ({ id: z.id, nazev: z.nazev, vyrobniCislo: z.vyrobniCislo, klient: s.klient }))),
    [klienti],
  )

  const filtered = useMemo(() => {
    const q = hledat.trim().toLowerCase()
    return klienti.filter(s => {
      if (filtr === 'kontrakt' && !maAktivniKontrakt(s)) return false
      if (filtr === 'bez-kontraktu' && !maZarizeniBezKontraktu(s)) return false
      if (filtr === 'zaruka' && !maKonciciZaruku(s)) return false
      if (!q) return true
      const hay = [
        s.klient.jmeno, s.klient.prijmeni, s.klient.telefon, s.klient.adresa,
        ...s.zarizeni.flatMap(z => [z.nazev, z.vyrobniCislo, ...z.kontrakty.map(k => k.nazev), ...z.kontrakty.map(k => k.cisloKontraktu)]),
        ...s.kontraktyBezZarizeni.map(k => k.nazev),
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [klienti, hledat, filtr])

  // Při hledání/filtru rozbalit vše, co prošlo (jinak by uživatel klikal na každou kartu).
  const rozbalitVse = hledat.trim().length > 0 || filtr !== 'vse'

  function toggle(id: string) {
    setOtevrene(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const refresh = () => router.refresh()

  return (
    <>
      {/* Filtry + akce */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2 flex-wrap">
          {FILTRY.map(f => (
            <button
              key={f.key}
              title={f.title}
              onClick={() => setFiltr(f.key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filtr === f.key
                  ? 'bg-green-600 text-white'
                  : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <input
          type="search"
          value={hledat}
          onChange={e => setHledat(e.target.value)}
          placeholder="Klient, zařízení, výrobní číslo, smlouva…"
          className="w-full sm:w-72 border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 dark:placeholder-slate-500"
        />
        {canManage && (
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => setNoveZarizeniPro('any')} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">+ Zařízení</button>
            <button onClick={() => setNovyKontraktPro('any')} className="px-3 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-slate-600 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-700">+ Kontrakt</button>
            <Link href="/servis/nova" className="px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors">+ Nová servisní akce</Link>
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-500 dark:text-slate-400">
            {klienti.length === 0 ? 'Zatím žádné zařízení ani smlouvy. Začni novou servisní akcí nebo přidej zařízení.' : 'Nic neodpovídá filtru'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(s => {
            const open = rozbalitVse || otevrene.has(s.klient.id)
            const pristi = pristiKlienta(s)
            const otevrenych = otevrenychKlienta(s)
            const aktivnichKontraktu = s.zarizeni.reduce((n, z) => n + z.kontrakty.filter(k => k.aktivni).length, 0) + s.kontraktyBezZarizeni.filter(k => k.aktivni).length
            const isFocus = s.klient.id === focusKlientId
            return (
              <div
                key={s.klient.id}
                ref={isFocus ? focusRef : undefined}
                className={`bg-white dark:bg-slate-800 rounded-xl border overflow-hidden ${isFocus ? 'border-green-400 dark:border-green-600 ring-1 ring-green-300 dark:ring-green-700' : 'border-gray-200 dark:border-slate-700'}`}
              >
                {/* Hlavička klienta */}
                <div className="flex items-center gap-3 px-5 py-3">
                  <button onClick={() => toggle(s.klient.id)} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                    <svg className={`w-4 h-4 text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-white truncate">{s.klient.prijmeni} {s.klient.jmeno}</p>
                      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
                        {[s.klient.adresa, s.klient.telefon].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                  </button>
                  <div className="hidden md:flex items-center gap-2 text-xs text-gray-500 dark:text-slate-400 flex-shrink-0">
                    <span>{s.zarizeni.filter(z => z.aktivni).length} zař.</span>
                    <span>·</span>
                    <span className={aktivnichKontraktu > 0 ? 'text-teal-700 dark:text-teal-300' : ''}>{aktivnichKontraktu} smluv</span>
                    {otevrenych > 0 && <><span>·</span><span className="text-green-700 dark:text-green-300">{otevrenych} otevř.</span></>}
                    {pristi?.planovanyTermin && (
                      <>
                        <span>·</span>
                        <span className={jeProsla(pristi.stav, pristi.planovanyTermin) ? 'text-red-600 dark:text-red-400 font-medium' : ''}>
                          příští {formatDate(pristi.planovanyTermin)}
                        </span>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Link href={`/clients/${s.klient.id}`} className="text-xs text-gray-500 dark:text-slate-400 hover:underline px-2 py-1">Karta</Link>
                    {canManage && (
                      <Link href={`/servis/nova?klientId=${s.klient.id}`} className="text-xs font-semibold text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 rounded-md px-2.5 py-1">
                        + Akce
                      </Link>
                    )}
                  </div>
                </div>

                {open && (
                  <div className="border-t border-gray-100 dark:border-slate-700 divide-y divide-gray-100 dark:divide-slate-700">
                    {s.zarizeni.map(z => {
                      const pristiZ = pristiNavsteva(z.zakazky)
                      const posledniZ = posledniDokoncena(z.zakazky)
                      const aktivniKontrakty = z.kontrakty.filter(k => k.aktivni)
                      return (
                        <div key={z.id} className={`px-5 py-3 ${z.aktivni ? '' : 'opacity-60'}`}>
                          <div className="flex flex-wrap items-start gap-3">
                            <div className="flex-1 min-w-[220px]">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="font-medium text-gray-900 dark:text-white">{z.nazev}</p>
                                <span className="text-xs text-gray-500 dark:text-slate-400">{ZARIZENI_TYP_LABEL[z.typ] ?? z.typ}</span>
                                {z.vyrobniCislo && <span className="text-xs font-mono text-gray-400 dark:text-slate-500">SN {z.vyrobniCislo}</span>}
                                <ZarukaBadge zarukaDo={z.zarukaDo} />
                                {!z.aktivni && <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300">neaktivní</span>}
                              </div>
                              <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
                                {z.datumInstalace && `instalace ${formatDate(z.datumInstalace)}`}
                                {z.deal && <>{z.datumInstalace && ' · '}<Link href={`/deals/${z.deal.id}`} className="hover:underline">{z.deal.kod ?? 'OP'}</Link></>}
                              </p>

                              {/* Smlouvy zařízení */}
                              <div className="mt-2 space-y-1">
                                {z.kontrakty.length === 0 ? (
                                  <p className="text-xs text-gray-400 dark:text-slate-500 italic">Bez servisní smlouvy</p>
                                ) : z.kontrakty.map(k => (
                                  <button
                                    key={k.id}
                                    onClick={() => setDetailKontraktId(k.id)}
                                    className={`flex items-center gap-2 text-xs rounded-md px-2 py-1 -mx-2 hover:bg-gray-50 dark:hover:bg-slate-700/50 text-left ${k.aktivni ? '' : 'opacity-60'}`}
                                  >
                                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${k.aktivni ? 'bg-teal-500' : 'bg-gray-300 dark:bg-slate-600'}`} />
                                    {k.cisloKontraktu && <span className="font-mono text-gray-400 dark:text-slate-500">{k.cisloKontraktu}</span>}
                                    <span className="font-medium text-gray-800 dark:text-slate-200">{k.nazev}</span>
                                    <span className="text-gray-500 dark:text-slate-400">{SERVIS_TYP_LABELS[k.typ]}{k.intervalMesicu > 0 ? ` · à ${k.intervalMesicu} měs.` : ''}</span>
                                    {!k.aktivni && <span className="text-gray-400">ukončeno</span>}
                                    <span className="text-green-600 dark:text-green-400">detail →</span>
                                  </button>
                                ))}
                              </div>
                            </div>

                            {/* Historie + příští */}
                            <div className="flex-1 min-w-[220px] space-y-1">
                              {posledniZ && <NavstevaRadek n={posledniZ} prefix="poslední" />}
                              {pristiZ && <NavstevaRadek n={pristiZ} prefix="příští" />}
                              {!posledniZ && !pristiZ && <p className="text-xs text-gray-400 dark:text-slate-500 italic">Zatím žádná servisní návštěva</p>}
                              {z.zakazky.length > 2 && (
                                <p className="text-[11px] text-gray-400 dark:text-slate-500">celkem {z.zakazky.length} zakázek</p>
                              )}
                            </div>

                            {/* Akce zařízení */}
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => setQr(z)} title="QR štítek" className="text-xs text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-white border border-gray-200 dark:border-slate-600 rounded-md px-2 py-1">QR</button>
                              {canManage && aktivniKontrakty.length === 0 && z.aktivni && (
                                <button onClick={() => setNovyKontraktPro(z.id)} className="text-xs text-teal-700 dark:text-teal-300 border border-teal-200 dark:border-teal-800 hover:bg-teal-50 dark:hover:bg-teal-900/20 rounded-md px-2 py-1">+ Smlouva</button>
                              )}
                              {canManage && (
                                <Link href={`/servis/nova?zarizeniId=${z.id}`} className="text-xs text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-md px-2 py-1">+ Akce</Link>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}

                    {s.kontraktyBezZarizeni.map(k => (
                      <div key={k.id} className="px-5 py-3">
                        <button onClick={() => setDetailKontraktId(k.id)} className="flex items-center gap-2 text-sm text-left hover:underline">
                          <span className={`w-1.5 h-1.5 rounded-full ${k.aktivni ? 'bg-teal-500' : 'bg-gray-300'}`} />
                          <span className="font-medium text-gray-900 dark:text-white">{k.nazev}</span>
                          <span className="text-xs text-gray-500 dark:text-slate-400">smlouva bez zařízení · {SERVIS_TYP_LABELS[k.typ]}</span>
                        </button>
                      </div>
                    ))}

                    {s.zakazkyBezZarizeni.length > 0 && (
                      <div className="px-5 py-3">
                        <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide mb-1.5">Servisní akce bez zařízení</p>
                        <div className="space-y-1">
                          {s.zakazkyBezZarizeni.slice(0, 5).map(n => <NavstevaRadek key={n.id} n={n} />)}
                          {s.zakazkyBezZarizeni.length > 5 && <p className="text-[11px] text-gray-400 dark:text-slate-500">a dalších {s.zakazkyBezZarizeni.length - 5}</p>}
                        </div>
                      </div>
                    )}

                    {canManage && (
                      <div className="px-5 py-2 flex gap-3">
                        <button onClick={() => setNoveZarizeniPro(s.klient.id)} className="text-xs text-gray-600 dark:text-slate-300 hover:underline">+ Přidat zařízení klientovi</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {qr && <QrModal zarizeni={qr} onClose={() => setQr(null)} />}
      {noveZarizeniPro && (
        <NoveZarizeniModal
          clients={clients}
          klientId={noveZarizeniPro === 'any' ? undefined : noveZarizeniPro}
          onClose={() => setNoveZarizeniPro(null)}
          onCreated={() => { setNoveZarizeniPro(null); refresh() }}
        />
      )}
      {novyKontraktPro && (
        <NovyKontraktModal
          zarizeniList={zarizeniList}
          zarizeniId={novyKontraktPro === 'any' ? undefined : novyKontraktPro}
          onClose={() => setNovyKontraktPro(null)}
          onCreated={() => { setNovyKontraktPro(null); refresh() }}
        />
      )}
      {detailKontrakt && (
        <KontraktDetailPanel
          kontrakt={detailKontrakt}
          orgUsers={orgUsers}
          onClose={() => setDetailKontraktId(null)}
          onChanged={refresh}
        />
      )}
    </>
  )
}
