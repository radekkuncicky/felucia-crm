'use client'

import { useState, useRef, useEffect } from 'react'

interface Client {
  id: string
  jmeno: string
  prijmeni: string
}

interface Props {
  clients: Client[]
  value: string
  onChange: (clientId: string) => void
}

interface CreateForm {
  prijmeni: string
  jmeno: string
  telefon: string
  email: string
  ico: string
  mesto: string
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
  // Parse initial text: last space-separated word = jmeno, rest = prijmeni (Czech CRM convention)
  const parts = initialText.trim().split(' ')
  const [form, setForm] = useState<CreateForm>({
    prijmeni: parts.length > 1 ? parts.slice(0, -1).join(' ') : initialText,
    jmeno: parts.length > 1 ? parts[parts.length - 1] : '',
    telefon: '',
    email: '',
    ico: '',
    mesto: '',
  })
  const [saving, setSaving] = useState(false)
  const [aresLoading, setAresLoading] = useState(false)
  const [error, setError] = useState('')

  function set(field: keyof CreateForm, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function loadFromAres() {
    if (!form.ico.trim()) return
    setAresLoading(true)
    setError('')
    try {
      const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${form.ico.trim()}`)
      if (!res.ok) { setError('IČO nenalezeno v ARES'); return }
      const data = await res.json()
      const adresa = data.sidlo ?? {}
      const mestoParsed = adresa.nazevObce ?? ''
      const nazev: string = data.obchodniJmeno ?? ''
      // Split company name: last word = jmeno, rest = prijmeni (best-effort)
      const nameParts = nazev.trim().split(' ')
      setForm(f => ({
        ...f,
        prijmeni: nameParts.length > 1 ? nameParts.slice(0, -1).join(' ') : nazev,
        jmeno: nameParts.length > 1 ? nameParts[nameParts.length - 1] : '',
        mesto: mestoParsed || f.mesto,
      }))
    } catch {
      setError('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.prijmeni.trim()) { setError('Příjmení je povinné'); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jmeno: form.jmeno.trim() || '-',
          prijmeni: form.prijmeni.trim(),
          telefon: form.telefon || null,
          email: form.email || null,
          ico: form.ico || null,
          mesto: form.mesto || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json()
        setError(d.error || 'Chyba při vytváření klienta')
        return
      }
      const client = await res.json()
      onCreated({ id: client.id, jmeno: client.jmeno, prijmeni: client.prijmeni })
    } catch {
      setError('Chyba při vytváření klienta')
    } finally {
      setSaving(false)
    }
  }

  const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400'

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-[480px]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-gray-900 dark:text-white">Nový klient</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-3">
          {error && <div className="bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Příjmení *</label>
              <input type="text" required value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} className={inp} placeholder="Novák" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Jméno</label>
              <input type="text" value={form.jmeno} onChange={e => set('jmeno', e.target.value)} className={inp} placeholder="Jan" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Telefon</label>
              <input type="tel" value={form.telefon} onChange={e => set('telefon', e.target.value)} className={inp} placeholder="+420 …" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">E-mail</label>
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inp} placeholder="jan@…" />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">IČO</label>
              <input type="text" value={form.ico} onChange={e => set('ico', e.target.value)} className={inp} placeholder="12345678" maxLength={8} />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={loadFromAres}
                disabled={aresLoading || !form.ico.trim()}
                className="px-3 py-2 text-sm font-semibold text-green-700 dark:text-green-400 border border-green-300 dark:border-green-700 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 disabled:opacity-40 whitespace-nowrap"
              >
                {aresLoading ? '…' : 'ARES'}
              </button>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 dark:text-slate-400 mb-1">Město</label>
              <input type="text" value={form.mesto} onChange={e => set('mesto', e.target.value)} className={inp} placeholder="Praha" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold px-4 py-2 rounded-lg text-sm"
            >
              {saving ? 'Vytvářím…' : 'Vytvořit a použít'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 border border-gray-300 dark:border-slate-600 rounded-lg"
            >
              Zrušit
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ClientSelectWithCreate({ clients, value, onChange }: Props) {
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
    setInputVal(`${c.prijmeni} ${c.jmeno}`.trim())
    setOpen(false)
  }

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    setInputVal(e.target.value)
    setOpen(true)
    if (e.target.value === '') onChange('')
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
          placeholder="Vyhledat klienta…"
          autoComplete="off"
          className="w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400 pr-8"
        />
        {value && (
          <button
            type="button"
            onClick={() => { onChange(''); setInputVal(''); setOpen(false); inputRef.current?.focus() }}
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
