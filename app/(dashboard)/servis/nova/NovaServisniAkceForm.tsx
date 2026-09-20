'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import ClientSelectWithCreate, { type Client } from '@/components/ClientSelectWithCreate'
import { ZARIZENI_TYP_LABEL } from '@/lib/calendarEvents'
import { type NavstevaTyp, type ServisPriorita, TYP_LABELS, PRIORITA_LABELS } from '@/lib/servisStav'

interface ZarizeniItem {
  id: string
  klientId: string
  nazev: string
  typ: string
  vyrobniCislo: string | null
  kontrakt: { id: string; nazev: string } | null
}

interface Props {
  clients: Client[]
  zarizeniList: ZarizeniItem[]
  orgUsers: { id: string; jmeno: string }[]
  initialKlientId: string
  initialZarizeniId: string
}

function formatAdresa(k: Client | null | undefined) {
  if (!k) return ''
  const radek2 = [k.psc, k.mesto].filter(Boolean).join(' ')
  return [k.ulice, radek2].filter(Boolean).join(', ')
}

const inputClass =
  'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 placeholder-gray-400 dark:placeholder-slate-500'
const labelClass = 'block text-xs font-semibold text-gray-600 dark:text-slate-400 mb-1'

function Blok({
  cislo,
  title,
  hint,
  children,
  disabled,
}: {
  cislo: number
  title: string
  hint?: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <section
      className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 transition-opacity ${
        disabled ? 'opacity-50 pointer-events-none select-none' : ''
      }`}
    >
      <div className="flex items-center gap-3 mb-4">
        <span className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-sm font-bold flex items-center justify-center flex-shrink-0">
          {cislo}
        </span>
        <div>
          <h2 className="font-semibold text-gray-900 dark:text-white leading-tight">{title}</h2>
          {hint && <p className="text-xs text-gray-500 dark:text-slate-400">{hint}</p>}
        </div>
      </div>
      {children}
    </section>
  )
}

export default function NovaServisniAkceForm({ clients, zarizeniList, orgUsers, initialKlientId, initialZarizeniId }: Props) {
  const router = useRouter()
  const initialKlient = clients.find(c => c.id === initialKlientId) ?? null

  const [klientId, setKlientId] = useState(initialKlientId)
  const [klient, setKlient] = useState<Client | null>(initialKlient)
  const [zarizeniId, setZarizeniId] = useState(initialZarizeniId)
  const [noveZarizeniOpen, setNoveZarizeniOpen] = useState(false)
  const [noveZarizeni, setNoveZarizeni] = useState({ nazev: '', typ: 'KLIMATIZACE', vyrobniCislo: '' })
  const [typ, setTyp] = useState<NavstevaTyp>('PORUCHA')
  const [popis, setPopis] = useState('')
  const [priorita, setPriorita] = useState<ServisPriorita>('BEZNA')
  const [adresaZasahu, setAdresaZasahu] = useState(formatAdresa(initialKlient))
  const [adresaRucne, setAdresaRucne] = useState(false)
  const [kontaktOpen, setKontaktOpen] = useState(false)
  const [kontakt, setKontakt] = useState({ jmeno: '', telefon: '' })
  const [datum, setDatum] = useState('')
  const [cas, setCas] = useState('09:00')
  const [technikId, setTechnikId] = useState('')
  const [poznamka, setPoznamka] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const klientZarizeni = useMemo(() => zarizeniList.filter(z => z.klientId === klientId), [zarizeniList, klientId])
  const vybraneZarizeni = klientZarizeni.find(z => z.id === zarizeniId) ?? null

  function onKlientSelect(c: Client | null) {
    setKlient(c)
    setZarizeniId('')
    setNoveZarizeniOpen(false)
    // Adresu předvyplníme z klienta, dokud ji uživatel nepřepíše ručně.
    if (!adresaRucne) setAdresaZasahu(formatAdresa(c))
  }

  function vyberZarizeni(id: string) {
    setZarizeniId(prev => (prev === id ? '' : id))
    setNoveZarizeniOpen(false)
  }

  function otevritNoveZarizeni() {
    setZarizeniId('')
    setNoveZarizeniOpen(true)
  }

  const canSubmit = !!klientId && popis.trim().length > 0 && (!noveZarizeniOpen || noveZarizeni.nazev.trim().length > 0)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || saving) return
    setSaving(true)
    setError('')
    const planovanyTermin = datum ? `${datum}T${cas || '09:00'}:00` : null
    const res = await api.post<{ id: string }>(
      '/api/servis/zakazky',
      {
        klientId,
        zarizeniId: zarizeniId || null,
        noveZarizeni: noveZarizeniOpen
          ? { nazev: noveZarizeni.nazev, typ: noveZarizeni.typ, vyrobniCislo: noveZarizeni.vyrobniCislo || null }
          : null,
        typ,
        popis: popis.trim(),
        priorita,
        adresaZasahu: adresaZasahu.trim() || null,
        kontaktJmeno: kontaktOpen ? kontakt.jmeno || null : null,
        kontaktTelefon: kontaktOpen ? kontakt.telefon || null : null,
        planovanyTermin,
        technikId: technikId || null,
        poznamka: poznamka.trim() || null,
      },
      { errorMessage: 'Servisní akci se nepodařilo založit.' },
    )
    if (res.ok && res.data) {
      router.push(`/servis/zakazky/${res.data.id}`)
      return
    }
    setError((res.data as { error?: string } | null)?.error ?? 'Servisní akci se nepodařilo založit.')
    setSaving(false)
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {/* 1. Kdo */}
      <Blok cislo={1} title="Kdo volá" hint="Vyhledej klienta, nebo ho rovnou založ — stačí příjmení a telefon.">
        <ClientSelectWithCreate
          clients={clients}
          value={klientId}
          onChange={setKlientId}
          onSelect={onKlientSelect}
          placeholder="Příjmení, jméno nebo firma…"
        />
        {klient && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600 dark:text-slate-300">
            <span className="font-medium text-gray-900 dark:text-white">{klient.prijmeni} {klient.jmeno}</span>
            {klient.telefon && <a href={`tel:${klient.telefon}`} className="hover:underline">{klient.telefon}</a>}
            {formatAdresa(klient) && <span className="text-gray-500 dark:text-slate-400">{formatAdresa(klient)}</span>}
            <Link href={`/clients/${klient.id}`} className="text-xs text-primary hover:underline">Otevřít kartu</Link>
          </div>
        )}
      </Blok>

      {/* 2. Co */}
      <Blok
        cislo={2}
        title="Jaké zařízení"
        hint={klientId ? 'Vyber existující, založ nové, nebo nech prázdné — doplní technik na místě.' : 'Nejdřív vyber klienta.'}
        disabled={!klientId}
      >
        <div className="flex flex-wrap gap-2">
          {klientZarizeni.map(z => {
            const active = z.id === zarizeniId
            return (
              <button
                key={z.id}
                type="button"
                onClick={() => vyberZarizeni(z.id)}
                className={`text-left px-3 py-2 rounded-lg border text-sm transition-colors ${
                  active
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                    : 'border-gray-300 dark:border-slate-600 hover:border-green-400 text-gray-800 dark:text-slate-200'
                }`}
              >
                <span className="font-medium">{z.nazev}</span>
                <span className="block text-xs text-gray-500 dark:text-slate-400">
                  {ZARIZENI_TYP_LABEL[z.typ] ?? z.typ}
                  {z.vyrobniCislo && ` · SN ${z.vyrobniCislo}`}
                  {z.kontrakt && ' · kontrakt'}
                </span>
              </button>
            )
          })}
          <button
            type="button"
            onClick={otevritNoveZarizeni}
            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${
              noveZarizeniOpen
                ? 'border-green-500 bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                : 'border-dashed border-gray-300 dark:border-slate-600 text-gray-600 dark:text-slate-300 hover:border-green-400'
            }`}
          >
            + Nové zařízení
          </button>
        </div>

        {klientId && klientZarizeni.length === 0 && !noveZarizeniOpen && (
          <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">Klient zatím nemá žádné zařízení v evidenci.</p>
        )}

        {vybraneZarizeni?.kontrakt && (
          <p className="mt-3 text-xs text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-900/20 rounded-lg px-3 py-2">
            Zařízení je kryté kontraktem &bdquo;{vybraneZarizeni.kontrakt.nazev}&ldquo; — akce se k němu připojí.
          </p>
        )}

        {noveZarizeniOpen && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className={labelClass}>Název *</label>
              <input
                value={noveZarizeni.nazev}
                onChange={e => setNoveZarizeni(f => ({ ...f, nazev: e.target.value }))}
                className={inputClass}
                placeholder="Daikin Perfera 3,5 kW"
                autoFocus
              />
            </div>
            <div>
              <label className={labelClass}>Typ</label>
              <select value={noveZarizeni.typ} onChange={e => setNoveZarizeni(f => ({ ...f, typ: e.target.value }))} className={inputClass}>
                {Object.entries(ZARIZENI_TYP_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Výrobní číslo</label>
              <input
                value={noveZarizeni.vyrobniCislo}
                onChange={e => setNoveZarizeni(f => ({ ...f, vyrobniCislo: e.target.value }))}
                className={inputClass}
                placeholder="volitelné"
              />
            </div>
          </div>
        )}
      </Blok>

      {/* 3. Problém */}
      <Blok cislo={3} title="Co se děje" hint="Popis uvidí technik v appce i v protokolu." disabled={!klientId}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Typ akce</label>
              <select value={typ} onChange={e => setTyp(e.target.value as NavstevaTyp)} className={inputClass}>
                {Object.entries(TYP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Priorita</label>
              <div className="grid grid-cols-2 rounded-lg border border-gray-300 dark:border-slate-600 overflow-hidden">
                {(Object.keys(PRIORITA_LABELS) as ServisPriorita[]).map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPriorita(p)}
                    className={`py-2 text-sm font-medium transition-colors ${
                      priorita === p
                        ? p === 'URGENTNI'
                          ? 'bg-red-600 text-white'
                          : 'bg-green-600 text-white'
                        : 'bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-200 hover:bg-gray-50 dark:hover:bg-slate-600'
                    }`}
                  >
                    {PRIORITA_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Popis závady / požadavku *</label>
            <textarea
              value={popis}
              onChange={e => setPopis(e.target.value)}
              rows={3}
              className={inputClass}
              placeholder="Klimatizace nechladí, venkovní jednotka hlučí, hlásí chybu E7…"
            />
          </div>

          <div>
            <label className={labelClass}>Adresa místa zásahu</label>
            <input
              value={adresaZasahu}
              onChange={e => { setAdresaZasahu(e.target.value); setAdresaRucne(true) }}
              className={inputClass}
              placeholder="Ulice 12, 110 00 Praha"
            />
            {klient && !adresaRucne && adresaZasahu && (
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">Předvyplněno z karty klienta — přepiš, pokud je zařízení jinde.</p>
            )}
          </div>

          {!kontaktOpen ? (
            <button type="button" onClick={() => setKontaktOpen(true)} className="text-sm text-primary hover:underline">
              + Na místě bude jiná osoba než klient
            </button>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Kontakt na místě — jméno</label>
                <input value={kontakt.jmeno} onChange={e => setKontakt(k => ({ ...k, jmeno: e.target.value }))} className={inputClass} placeholder="pan Dvořák (správce)" />
              </div>
              <div>
                <label className={labelClass}>Telefon</label>
                <input type="tel" value={kontakt.telefon} onChange={e => setKontakt(k => ({ ...k, telefon: e.target.value }))} className={inputClass} placeholder="+420 …" />
              </div>
            </div>
          )}
        </div>
      </Blok>

      {/* 4. Kdy / kdo */}
      <Blok cislo={4} title="Kdy a kdo" hint="Volitelné. Bez termínu skončí akce v poolu Nezaplánované v plánu servisů." disabled={!klientId}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div>
            <label className={labelClass}>Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className={labelClass}>Čas</label>
            <input type="time" value={cas} onChange={e => setCas(e.target.value)} className={inputClass} disabled={!datum} />
          </div>
          <div className="col-span-2">
            <label className={labelClass}>Technik</label>
            <select value={technikId} onChange={e => setTechnikId(e.target.value)} className={inputClass}>
              <option value="">— nepřiřazen —</option>
              {orgUsers.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
            </select>
          </div>
        </div>
        <div className="mt-3">
          <label className={labelClass}>Interní poznámka</label>
          <textarea value={poznamka} onChange={e => setPoznamka(e.target.value)} rows={2} className={inputClass} placeholder="Jen pro nás — klient ji nevidí." />
        </div>
      </Blok>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>
      )}

      <div className="flex items-center justify-between gap-3 pb-6">
        <Link href="/servis/zakazky" className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
          Zrušit
        </Link>
        <button
          type="submit"
          disabled={!canSubmit || saving}
          className="px-5 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold"
        >
          {saving ? 'Zakládám…' : datum ? 'Založit a naplánovat' : 'Založit servisní akci'}
        </button>
      </div>
    </form>
  )
}
