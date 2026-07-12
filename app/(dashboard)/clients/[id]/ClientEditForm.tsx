'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { parseEmailInput } from '@/lib/parseEmail'
import ConfirmModal from '@/components/ConfirmModal'
import { formatDate } from '@/lib/format'

function parseFullAddress(text: string): { ulice: string; psc: string; mesto: string } | null {
  const trimmed = text.trim()
  // Matches: "Ulice 12/3, 736 01 Havířov" or "Ulice 12/3 73601 Havířov"
  const match = trimmed.match(/^(.+?),?\s+(\d{3}\s?\d{2})\s+(.+)$/)
  if (!match) return null
  const pscRaw = match[2].replace(/\s/g, '')
  return {
    ulice: match[1].trim(),
    psc: `${pscRaw.slice(0, 3)} ${pscRaw.slice(3)}`,
    mesto: match[3].trim(),
  }
}

type TypKlienta = 'FYZICKA_OSOBA' | 'FIRMA'

interface ClientData {
  id: string
  typKlienta: TypKlienta
  jmeno: string
  prijmeni: string
  telefon: string
  email: string
  ulice: string
  mesto: string
  psc: string
  ico: string
  dic: string
  poznamka: string
  anonymizedAt: string | null
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white'
const lbl = 'block text-xs font-medium text-gray-500 dark:text-slate-400 mb-1'

export default function ClientEditForm({ client, isAdmin }: { client: ClientData; isAdmin: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aresLoading, setAresLoading] = useState(false)
  const [typKlienta, setTypKlienta] = useState<TypKlienta>(client.typKlienta)
  const [form, setForm] = useState<ClientData>({ ...client })
  const [adresaHint, setAdresaHint] = useState(false)
  const [showAnonymizeConfirm, setShowAnonymizeConfirm] = useState(false)
  const [anonymizing, setAnonymizing] = useState(false)

  function set(field: keyof ClientData, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function cancel() {
    setEditing(false)
    setTypKlienta(client.typKlienta)
    setForm({ ...client })
  }

  async function loadFromAres() {
    const ico = form.ico.trim()
    if (!ico) return
    setAresLoading(true)
    setError('')
    try {
      const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`)
      if (!res.ok) { setError('IČO nenalezeno v ARES'); return }
      const data = await res.json()
      const adresa = data.sidlo ?? {}
      const ulice = [adresa.nazevUlice, adresa.cisloDomovni && adresa.cisloOrientacni
        ? `${adresa.cisloDomovni}/${adresa.cisloOrientacni}`
        : adresa.cisloDomovni ?? ''].filter(Boolean).join(' ')
      setForm(f => ({
        ...f,
        jmeno: data.obchodniJmeno ?? f.jmeno,
        ulice: ulice || f.ulice,
        mesto: adresa.nazevObce ?? f.mesto,
        psc: adresa.psc ? String(adresa.psc) : f.psc,
        dic: data.dic ?? f.dic,
      }))
    } catch {
      setError('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    try {
      const payload =
        typKlienta === 'FIRMA'
          ? {
              typKlienta: 'FIRMA',
              jmeno: form.jmeno,
              prijmeni: form.prijmeni, // kontaktní osoba
              telefon: form.telefon || null,
              email: form.email || null,
              ulice: form.ulice || null,
              mesto: form.mesto || null,
              psc: form.psc || null,
              ico: form.ico || null,
              dic: form.dic || null,
              poznamka: form.poznamka || null,
            }
          : {
              typKlienta: 'FYZICKA_OSOBA',
              jmeno: form.jmeno,
              prijmeni: form.prijmeni,
              telefon: form.telefon || null,
              email: form.email || null,
              ulice: form.ulice || null,
              mesto: form.mesto || null,
              psc: form.psc || null,
              ico: null,
              dic: null,
              poznamka: form.poznamka || null,
            }

      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      setEditing(false)
      router.refresh()
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  const adresaDisplay = [form.ulice, [form.mesto, form.psc].filter(Boolean).join(' ')].filter(Boolean).join(', ')
  const displayName = typKlienta === 'FIRMA' ? form.jmeno : `${form.jmeno} ${form.prijmeni}`.trim()

  async function handleAnonymize() {
    setAnonymizing(true)
    setError('')
    try {
      const res = await fetch(`/api/clients/${client.id}/anonymize`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Anonymizace selhala')
        return
      }
      setShowAnonymizeConfirm(false)
      router.refresh()
    } catch {
      setError('Anonymizace selhala')
    } finally {
      setAnonymizing(false)
    }
  }

  if (client.anonymizedAt) {
    return (
      <div className="space-y-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-3">
          <h2 className="font-semibold text-gray-900 dark:text-white">Kontaktní údaje</h2>
          <div className="bg-gray-50 dark:bg-slate-700/50 border border-gray-200 dark:border-slate-600 rounded-lg px-3 py-2.5 text-sm text-gray-600 dark:text-slate-300">
            Klient anonymizován dne {formatDate(client.anonymizedAt)} — osobní údaje byly odstraněny na žádost
            klienta (GDPR). Vazby na obchodní případy a zakázky zůstávají zachovány.
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <ConfirmModal
        isOpen={showAnonymizeConfirm}
        title="Anonymizovat klienta"
        message="Jméno, telefon, email, adresa a IČO/DIČ budou nahrazeny anonymním placeholderem a nepůjde je vrátit zpět. Obchodní případy, zakázky a servisní historie klienta zůstanou zachovány beze změny — jen ztratí vazbu na osobní údaje. Použij, jen když klient požádal o výmaz podle GDPR."
        confirmLabel="Anonymizovat"
        danger
        loading={anonymizing}
        onConfirm={handleAnonymize}
        onCancel={() => setShowAnonymizeConfirm(false)}
      />

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 dark:text-white">Kontaktní údaje</h2>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-blue-600 hover:text-blue-800 dark:text-blue-400">
              Upravit
            </button>
          )}
        </div>

        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-3 py-2 rounded-lg">{error}</div>}

        {editing ? (
          <div className="space-y-4">
            {/* Toggle typ */}
            <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg w-fit">
              {(['FYZICKA_OSOBA', 'FIRMA'] as TypKlienta[]).map(typ => (
                <button
                  key={typ}
                  type="button"
                  onClick={() => setTypKlienta(typ)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    typKlienta === typ
                      ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 dark:text-slate-400 hover:text-gray-700'
                  }`}
                >
                  {typ === 'FYZICKA_OSOBA' ? '👤 Fyzická osoba' : '🏢 Firma'}
                </button>
              ))}
            </div>

            {typKlienta === 'FYZICKA_OSOBA' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Jméno</label>
                  <input value={form.jmeno} onChange={e => set('jmeno', e.target.value)} className={inp} />
                </div>
                <div>
                  <label className={lbl}>Příjmení</label>
                  <input value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} className={inp} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Název firmy</label>
                  <input value={form.jmeno} onChange={e => set('jmeno', e.target.value)} className={inp} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>IČO</label>
                    <div className="flex gap-2">
                      <input value={form.ico} onChange={e => set('ico', e.target.value)} className={inp} placeholder="12345678" />
                      <button
                        type="button"
                        onClick={loadFromAres}
                        disabled={aresLoading || !form.ico.trim()}
                        title="Načíst z ARES"
                        className="flex-shrink-0 px-2 py-1.5 text-xs border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-40"
                      >
                        {aresLoading ? '…' : 'ARES'}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={lbl}>DIČ</label>
                    <input value={form.dic} onChange={e => set('dic', e.target.value)} className={inp} placeholder="CZ12345678" />
                  </div>
                </div>
                <div>
                  <label className={lbl}>Kontaktní osoba</label>
                  <input value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} className={inp} placeholder="Jméno kontaktní osoby" />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={lbl}>Telefon</label>
                <input value={form.telefon} onChange={e => set('telefon', e.target.value)} className={inp} />
              </div>
              <div>
                <label className={lbl}>Email</label>
                <input
                  value={form.email}
                  onChange={e => set('email', e.target.value)}
                  onPaste={e => {
                    const text = e.clipboardData.getData('text')
                    const parsed = parseEmailInput(text)
                    if (parsed !== text) {
                      e.preventDefault()
                      set('email', parsed)
                    }
                  }}
                  onBlur={e => set('email', parseEmailInput(e.target.value))}
                  className={inp}
                />
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-3">Kontaktní adresa</p>
              <div className="space-y-3">
                <div>
                  <label className={lbl}>Ulice a číslo popisné</label>
                  <input
                    value={form.ulice}
                    onChange={e => set('ulice', e.target.value)}
                    onPaste={e => {
                      const text = e.clipboardData.getData('text')
                      const parsed = parseFullAddress(text)
                      if (parsed) {
                        e.preventDefault()
                        setForm(f => ({ ...f, ulice: parsed.ulice, psc: parsed.psc, mesto: parsed.mesto }))
                        setAdresaHint(true)
                        setTimeout(() => setAdresaHint(false), 3000)
                      }
                    }}
                    className={inp}
                    placeholder="Nebo vložte celou adresu, např. Školní 27, 736 01 Havířov"
                  />
                  {adresaHint && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Adresa rozpoznána a rozdělena do polí</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={lbl}>Město</label>
                    <input value={form.mesto} onChange={e => set('mesto', e.target.value)} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>PSČ</label>
                    <input value={form.psc} onChange={e => set('psc', e.target.value)} className={inp} />
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 dark:border-slate-700 pt-4">
              <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase mb-3">Poznámka</p>
              <textarea
                value={form.poznamka}
                onChange={e => set('poznamka', e.target.value)}
                rows={3}
                className={inp}
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-3 py-1.5 rounded-lg text-sm"
              >
                {saving ? 'Ukládám…' : 'Uložit'}
              </button>
              <button onClick={cancel} className="text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900 px-3 py-1.5">
                Zrušit
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {client.typKlienta === 'FIRMA' ? 'Název firmy' : 'Jméno'}
              </p>
              <p className="text-sm font-medium text-gray-900 dark:text-white">{displayName}</p>
            </div>
            {client.typKlienta === 'FIRMA' && client.prijmeni && (
              <div>
                <p className="text-xs text-gray-500 dark:text-slate-400">Kontaktní osoba</p>
                <p className="text-sm text-gray-900 dark:text-slate-100">{client.prijmeni}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Telefon</p>
              <p className="text-sm text-gray-900 dark:text-slate-100">{client.telefon || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-slate-400">Email</p>
              <p className="text-sm text-gray-900 dark:text-slate-100">{client.email || '—'}</p>
            </div>

            {(client.ico || client.dic) && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3 grid grid-cols-2 gap-3">
                {client.ico && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">IČO</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-slate-100">{client.ico}</p>
                  </div>
                )}
                {client.dic && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-slate-400">DIČ</p>
                    <p className="text-sm font-mono text-gray-900 dark:text-slate-100">{client.dic}</p>
                  </div>
                )}
              </div>
            )}

            {adresaDisplay && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">Adresa</p>
                <p className="text-sm text-gray-900 dark:text-slate-100">{adresaDisplay}</p>
              </div>
            )}

            {client.poznamka && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <p className="text-xs text-gray-500 dark:text-slate-400">Poznámka</p>
                <p className="text-sm text-gray-700 dark:text-slate-300 whitespace-pre-wrap">{client.poznamka}</p>
              </div>
            )}

            {isAdmin && (
              <div className="border-t border-gray-100 dark:border-slate-700 pt-3">
                <button
                  onClick={() => setShowAnonymizeConfirm(true)}
                  className="text-xs text-red-500 hover:text-red-700 dark:hover:text-red-400"
                >
                  Anonymizovat klienta (GDPR výmaz)
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
