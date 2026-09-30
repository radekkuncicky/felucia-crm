'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { confirmDialog } from '@/components/ui/confirm'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'
import type { AresFirma } from '@/hooks/useAresLookup'

export interface Client {
  id: string
  jmeno: string
  prijmeni: string
  // Volitelné — vrací je API po založení; servis/nova z nich předvyplní místo zásahu.
  telefon?: string | null
  ulice?: string | null
  mesto?: string | null
  psc?: string | null
}

interface Props {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
  /** Celý objekt vybraného/založeného klienta (null při odznačení). */
  onSelect?: (client: Client | null) => void
  placeholder?: string
}

interface CreateForm {
  /** Osoba: křestní jméno · firma: název firmy (jako clients/new) */
  jmeno: string
  /** Osoba: příjmení · firma: kontaktní osoba */
  prijmeni: string
  telefon: string
  email: string
  ico: string
  dic: string
  ulice: string
  mesto: string
  psc: string
}

function CreateClientModal({
  initialText,
  onCreated,
  onCancel,
}: {
  initialText: string
  onCreated: (client: Client) => void
  onCancel: () => void
}) {
  const formId = useId()
  // Parse initial text: last space-separated word = jmeno, rest = prijmeni (Czech CRM convention)
  const parts = initialText.trim().split(' ')
  const [firma, setFirma] = useState(false)
  const [form, setForm] = useState<CreateForm>({
    prijmeni: parts.length > 1 ? parts.slice(0, -1).join(' ') : initialText,
    jmeno: parts.length > 1 ? parts[parts.length - 1] : '',
    telefon: '',
    email: '',
    ico: '',
    dic: '',
    ulice: '',
    mesto: '',
    psc: '',
  })
  const [saving, setSaving] = useState(false)
  const [aresLoading, setAresLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof CreateForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  // Přepnutí typu: text z vyhledávání patří do názvu firmy, resp. zpět do příjmení
  function zmenitTyp(naFirmu: boolean) {
    if (naFirmu === firma) return
    setFirma(naFirmu)
    setForm(f => naFirmu
      ? { ...f, jmeno: `${f.prijmeni} ${f.jmeno}`.trim(), prijmeni: '' }
      : { ...f, prijmeni: f.jmeno, jmeno: '' })
  }

  // Přes vlastní /api/ares — přímé volání ares.gov.cz z prohlížeče blokuje CSP (connect-src)
  async function loadFromAres() {
    if (!form.ico.trim()) return
    setAresLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/ares?q=${encodeURIComponent(form.ico.trim())}`)
      const firmy = res.ok ? await res.json() as AresFirma[] : []
      if (!firmy.length) { setError('IČO nenalezeno v ARES'); return }
      const f0 = firmy[0]
      // Firma z ARES: název celý do jmeno, kontaktní osoba zůstává prázdná
      setFirma(true)
      setForm(f => ({
        ...f,
        jmeno: f0.nazev.trim(),
        prijmeni: '',
        ico: f0.ico || f.ico,
        dic: f0.dic || f.dic,
        ulice: f0.ulice || f.ulice,
        mesto: f0.mesto || f.mesto,
        psc: f0.psc || f.psc,
      }))
    } catch {
      setError('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Modal bývá uvnitř jiného formuláře (nová OP, servis/nova). Dialog je v portálu
    // (vnořený <form> v DOM nevznikne) a stopPropagation brání tomu, aby React
    // probublal submit do vnějšího formuláře.
    e.stopPropagation()
    if (firma ? !form.jmeno.trim() : !form.prijmeni.trim()) {
      setError(firma ? 'Název firmy je povinný' : 'Příjmení je povinné')
      return
    }
    setSaving(true)
    setError('')
    try {
      const dupRes = await fetch('/api/clients/check-duplicate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jmeno: form.jmeno, prijmeni: form.prijmeni, telefon: form.telefon, email: form.email }),
      })
      if (dupRes.ok) {
        const { match } = await dupRes.json()
        if (match) {
          const popis = [`${match.jmeno} ${match.prijmeni}`.trim(), match.telefon, match.email].filter(Boolean).join(' · ')
          const pouzitStavajiciho = await confirmDialog(popis, {
            title: 'Nemyslíte náhodou tohoto klienta?',
            confirmLabel: 'Ano, použít tohoto klienta',
            cancelLabel: 'Ne, jde o jiného',
            danger: false,
          })
          if (pouzitStavajiciho) {
            onCreated({ ...match, id: match.id, jmeno: match.jmeno, prijmeni: match.prijmeni })
            return
          }
        }
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          typKlienta: firma ? 'FIRMA' : 'FYZICKA_OSOBA',
          jmeno: form.jmeno.trim() || '-',
          prijmeni: form.prijmeni.trim(),
          telefon: form.telefon || null,
          email: form.email || null,
          ico: form.ico || null,
          dic: form.dic || null,
          ulice: form.ulice || null,
          mesto: form.mesto || null,
          psc: form.psc || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Chyba při vytváření klienta')
        return
      }
      const client = await res.json()
      onCreated({
        id: client.id,
        jmeno: client.jmeno,
        prijmeni: client.prijmeni,
        telefon: client.telefon ?? null,
        ulice: client.ulice ?? null,
        mesto: client.mesto ?? null,
        psc: client.psc ?? null,
      })
    } catch {
      setError('Chyba při vytváření klienta')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Nový klient"
      size="lg"
      layer="top"
      footer={<>
        <Button variant="secondary" onClick={onCancel}>Zrušit</Button>
        <Button type="submit" form={formId} loading={saving}>Vytvořit a použít</Button>
      </>}
    >
      <form id={formId} onSubmit={handleSubmit} className="space-y-3">
        {error && <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

        <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg w-fit" role="group" aria-label="Typ klienta">
          {([false, true] as const).map(jeFirma => (
            <button
              key={String(jeFirma)}
              type="button"
              data-compact
              aria-pressed={firma === jeFirma}
              onClick={() => zmenitTyp(jeFirma)}
              className={`hit-area px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                firma === jeFirma
                  ? 'bg-white dark:bg-slate-800 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
              }`}
            >
              {jeFirma ? 'Firma' : 'Fyzická osoba'}
            </button>
          ))}
        </div>

        {firma ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Název firmy" required className="sm:col-span-2">
              <Input value={form.jmeno} onChange={e => set('jmeno', e.target.value)} placeholder="Vzorová stavba s.r.o." autoComplete="organization" />
            </Field>
            <Field label="Kontaktní osoba" className="sm:col-span-2">
              <Input value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} placeholder="Jan Novák" autoComplete="name" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Příjmení" required>
              <Input value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} placeholder="Novák" autoComplete="family-name" />
            </Field>
            <Field label="Jméno">
              <Input value={form.jmeno} onChange={e => set('jmeno', e.target.value)} placeholder="Jan" autoComplete="given-name" />
            </Field>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="Telefon">
            <Input kind="tel" value={form.telefon} onChange={e => set('telefon', e.target.value)} placeholder="+420 …" />
          </Field>
          <Field label="E-mail">
            <Input kind="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="jan@…" />
          </Field>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="IČO" hint={firma ? undefined : 'Po načtení z ARES se klient přepne na firmu'}>
            <div className="flex gap-2">
              <Input kind="ico" value={form.ico} onChange={e => set('ico', e.target.value)} placeholder="12345678" />
              <Button variant="secondary" onClick={loadFromAres} disabled={!form.ico.trim()} loading={aresLoading} title="Načíst údaje z ARES podle IČO">
                ARES
              </Button>
            </div>
          </Field>
          {firma && (
            <Field label="DIČ">
              <Input value={form.dic} onChange={e => set('dic', e.target.value)} placeholder="CZ12345678" />
            </Field>
          )}
        </div>

        <Field label="Ulice a č. p.">
          <Input value={form.ulice} onChange={e => set('ulice', e.target.value)} placeholder="Dlouhá 12" autoComplete="street-address" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="Město" className="sm:col-span-2">
            <Input value={form.mesto} onChange={e => set('mesto', e.target.value)} placeholder="Praha" autoComplete="address-level2" />
          </Field>
          <Field label="PSČ">
            <Input kind="psc" value={form.psc} onChange={e => set('psc', e.target.value)} placeholder="110 00" />
          </Field>
        </div>
      </form>
    </Dialog>
  )
}

export default function ClientSelectWithCreate({ clients, value, onChange, onSelect, placeholder }: Props) {
  const [inputVal, setInputVal] = useState('')
  const [open, setOpen] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createText, setCreateText] = useState('')
  const dropRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync display name when value changes externally
  useEffect(() => {
    if (value) {
      const c = clients.find(c => c.id === value)
      if (c) setInputVal(`${c.prijmeni} ${c.jmeno}`.trim())
    } else {
      setInputVal('')
    }
  }, [value, clients])

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Restore label if a client is selected
        if (value) {
          const c = clients.find(c => c.id === value)
          if (c) setInputVal(`${c.prijmeni} ${c.jmeno}`.trim())
        }
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value, clients])

  const filtered = clients.filter(c => {
    if (!inputVal) return true
    const name = `${c.prijmeni} ${c.jmeno}`.toLowerCase()
    const name2 = `${c.jmeno} ${c.prijmeni}`.toLowerCase()
    const q = inputVal.toLowerCase()
    return name.includes(q) || name2.includes(q)
  })

  const selectedClient = clients.find(c => c.id === value)
  const isExactMatch = selectedClient && `${selectedClient.prijmeni} ${selectedClient.jmeno}`.toLowerCase() === inputVal.toLowerCase()
  const showCreate = inputVal.trim().length >= 1 && !isExactMatch

  function selectClient(c: Client) {
    onChange(c.id)
    onSelect?.(c)
    setInputVal(`${c.prijmeni} ${c.jmeno}`.trim())
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value)
    setOpen(true)
    if (e.target.value === '') { onChange(''); onSelect?.(null) }
  }

  return (
    <div ref={dropRef} className="relative">
      {/* Hidden input to satisfy native form validation */}
      <input type="hidden" name="clientId" value={value} required />

      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={handleInput}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? 'Vyhledat klienta…'}
          autoComplete="off"
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 pr-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); onSelect?.(null); setInputVal(''); setOpen(false); inputRef.current?.focus() }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-[100] mt-1 w-full bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-xl max-h-56 overflow-y-auto">
          {filtered.length === 0 && !showCreate && (
            <p className="text-sm text-gray-400 dark:text-slate-500 px-3 py-3 text-center">Žádní klienti</p>
          )}
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={e => { e.preventDefault(); selectClient(c) }}
              className={`w-full text-left px-3 py-2 text-sm transition-colors hover:bg-gray-50 dark:hover:bg-slate-700 ${
                value === c.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium' : 'text-gray-900 dark:text-white'
              }`}
            >
              {c.prijmeni} {c.jmeno}
            </button>
          ))}
          {showCreate && (
            <>
              {filtered.length > 0 && <div className="border-t border-gray-100 dark:border-slate-700" />}
              <button
                type="button"
                onMouseDown={e => {
                  e.preventDefault()
                  setCreateText(inputVal.trim())
                  setShowCreateModal(true)
                  setOpen(false)
                }}
                className="w-full text-left px-3 py-2.5 text-sm text-green-700 dark:text-green-400 font-semibold hover:bg-green-50 dark:hover:bg-green-900/20 flex items-center gap-2"
              >
                <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Vytvořit klienta &bdquo;{inputVal.trim()}&ldquo;
              </button>
            </>
          )}
        </div>
      )}

      {showCreateModal && (
        <CreateClientModal
          initialText={createText}
          onCreated={client => {
            // Add to clients list (local state update)
            clients.push(client) // mutate prop for immediate re-render availability
            selectClient(client)
            setShowCreateModal(false)
          }}
          onCancel={() => { setShowCreateModal(false); setOpen(false) }}
        />
      )}
    </div>
  )
}
