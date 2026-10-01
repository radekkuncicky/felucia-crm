'use client'

import { useState, useRef, useEffect, useId } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import ClientFormFields, { PRAZDNY_KLIENT, clientPayload, najdiDuplicitu, validateClient, type ClientFormData } from '@/components/ClientForm'

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
  // Text z vyhledávání: „Novák Jan" → příjmení Novák, jméno Jan (zvyk v CRM)
  const parts = initialText.trim().split(/\s+/)
  const [form, setForm] = useState<ClientFormData>({
    ...PRAZDNY_KLIENT,
    prijmeni: parts.length > 1 ? parts.slice(0, -1).join(' ') : initialText.trim(),
    jmeno: parts.length > 1 ? parts[parts.length - 1] : '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Modal bývá uvnitř jiného formuláře (nová OP, servis/nova). Dialog je v portálu
    // (vnořený <form> v DOM nevznikne) a stopPropagation brání tomu, aby React
    // probublal submit do vnějšího formuláře.
    e.stopPropagation()
    const chyba = validateClient(form)
    if (chyba) { setError(chyba); return }
    setSaving(true)
    setError('')
    try {
      const existujici = await najdiDuplicitu(form)
      if (existujici) {
        onCreated(existujici)
        return
      }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clientPayload(form)),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
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
      <form id={formId} onSubmit={handleSubmit} className="space-y-3" noValidate>
        {error && <div role="alert" className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}
        <ClientFormFields value={form} onChange={setForm} variant="compact" />
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
