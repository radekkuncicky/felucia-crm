'use client'

import { toast } from 'sonner'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import AresAutocomplete from '@/components/AresAutocomplete'
import type { AresFirma } from '@/hooks/useAresLookup'
import { parseEmailInput } from '@/lib/parseEmail'

function parseFullAddress(text: string): { ulice: string; psc: string; mesto: string } | null {
  const trimmed = text.trim()
  const match = trimmed.match(/^(.+?),?\s+(\d{3}\s?\d{2})\s+(.+)$/)
  if (!match) return null
  const pscRaw = match[2].replace(/\s/g, '')
  return {
    ulice: match[1].trim(),
    psc: `${pscRaw.slice(0, 3)} ${pscRaw.slice(3)}`,
    mesto: match[3].trim(),
  }
}

const inp = 'w-full border border-gray-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary bg-white dark:bg-slate-700 text-gray-900 dark:text-white placeholder-gray-400'
const label = 'block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1'

type TypKlienta = 'FYZICKA_OSOBA' | 'FIRMA'

export default function NewClientPage() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [aresLoading, setAresLoading] = useState(false)
  const [typKlienta, setTypKlienta] = useState<TypKlienta>('FYZICKA_OSOBA')
  const [adresaHint, setAdresaHint] = useState(false)
  const [form, setForm] = useState({
    jmeno: '', prijmeni: '', telefon: '', email: '',
    ulice: '', mesto: '', psc: '', ico: '', dic: '',
    kontaktniOsoba: '', poznamka: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function handleAresSelect(firma: AresFirma) {
    setForm(f => ({
      ...f,
      jmeno: firma.nazev || f.jmeno,
      ico: firma.ico || f.ico,
      dic: firma.dic ?? f.dic,
      ulice: firma.ulice || f.ulice,
      mesto: firma.mesto || f.mesto,
      psc: firma.psc || f.psc,
    }))
  }

  async function loadFromAres() {
    const ico = form.ico.trim()
    if (!ico) return
    setAresLoading(true)
    try {
      const res = await fetch(`/api/ares?q=${encodeURIComponent(ico)}`)
      if (!res.ok) { toast.error('IČO nenalezeno v ARES'); return }
      const firmy = await res.json() as AresFirma[]
      if (!firmy.length) { toast.error('IČO nenalezeno v ARES'); return }
      handleAresSelect(firmy[0])
    } catch {
      toast.error('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    try {
      const payload =
        typKlienta === 'FIRMA'
          ? {
              typKlienta: 'FIRMA',
              jmeno: form.jmeno,
              prijmeni: form.kontaktniOsoba || '',
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
              poznamka: form.poznamka || null,
            }

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Chyba při ukládání')
        return
      }
      const client = await res.json()
      router.push(`/clients/${client.id}`)
    } catch {
      setError('Chyba při ukládání')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients" className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-300">← Klienti</Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Nový klient</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && <div className="bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-sm px-4 py-3 rounded-lg">{error}</div>}

        {/* Toggle typ klienta */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
          <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg w-fit">
            {(['FYZICKA_OSOBA', 'FIRMA'] as TypKlienta[]).map(typ => (
              <button
                key={typ}
                type="button"
                onClick={() => setTypKlienta(typ)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  typKlienta === typ
                    ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {typ === 'FYZICKA_OSOBA' ? '👤 Fyzická osoba' : '🏢 Firma'}
              </button>
            ))}
          </div>
        </div>

        {/* Kontaktní údaje */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">
            {typKlienta === 'FIRMA' ? 'Firemní údaje' : 'Kontaktní údaje'}
          </h2>

          {typKlienta === 'FYZICKA_OSOBA' ? (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label}>Jméno *</label>
                <input type="text" required value={form.jmeno} onChange={e => set('jmeno', e.target.value)} className={inp} placeholder="Karel" />
              </div>
              <div>
                <label className={label}>Příjmení *</label>
                <input type="text" required value={form.prijmeni} onChange={e => set('prijmeni', e.target.value)} className={inp} placeholder="Novák" />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={label}>Vyhledat firmu v ARES</label>
                <AresAutocomplete onSelect={handleAresSelect} />
                <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">Zadejte název firmy nebo IČO — po výběru se pole vyplní automaticky</p>
              </div>
              <div>
                <label className={label}>Název firmy *</label>
                <input type="text" required value={form.jmeno} onChange={e => set('jmeno', e.target.value)} className={inp} placeholder="DeproStav s.r.o." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={label}>IČO</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={form.ico}
                      onChange={e => set('ico', e.target.value)}
                      className={inp}
                      placeholder="12345678"
                    />
                    <button
                      type="button"
                      onClick={loadFromAres}
                      disabled={aresLoading || !form.ico.trim()}
                      title="Načíst z ARES"
                      className="flex-shrink-0 px-3 py-2 text-sm border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-600 disabled:opacity-40 whitespace-nowrap"
                    >
                      {aresLoading ? '…' : 'ARES'}
                    </button>
                  </div>
                </div>
                <div>
                  <label className={label}>DIČ</label>
                  <input type="text" value={form.dic} onChange={e => set('dic', e.target.value)} className={inp} placeholder="CZ12345678" />
                </div>
              </div>
              <div>
                <label className={label}>Kontaktní osoba</label>
                <input type="text" value={form.kontaktniOsoba} onChange={e => set('kontaktniOsoba', e.target.value)} className={inp} placeholder="Šárka Kočurová" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Telefon</label>
              <input type="tel" value={form.telefon} onChange={e => set('telefon', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={label}>Email</label>
              <input
                type="text"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                onPaste={e => {
                  const text = e.clipboardData.getData('text')
                  const parsed = parseEmailInput(text)
                  if (parsed !== text) { e.preventDefault(); set('email', parsed) }
                }}
                onBlur={e => set('email', parseEmailInput(e.target.value))}
                className={inp}
              />
            </div>
          </div>
        </div>

        {/* Adresa */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Kontaktní adresa</h2>
          <div>
            <label className={label}>Ulice a číslo popisné</label>
            <input
              type="text"
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
              <p className="text-xs text-green-600 mt-1">✓ Adresa rozpoznána a rozdělena do polí</p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={label}>Město</label>
              <input type="text" value={form.mesto} onChange={e => set('mesto', e.target.value)} className={inp} />
            </div>
            <div>
              <label className={label}>PSČ</label>
              <input type="text" value={form.psc} onChange={e => set('psc', e.target.value)} className={inp} placeholder="700 00" />
            </div>
          </div>
        </div>

        {/* Poznámka */}
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-6 space-y-4">
          <h2 className="font-semibold text-gray-900 dark:text-white">Poznámka</h2>
          <textarea
            value={form.poznamka}
            onChange={e => set('poznamka', e.target.value)}
            rows={3}
            className={inp}
            placeholder="Interní poznámka ke klientovi…"
          />
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="bg-primary hover:bg-primary-hover disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            {saving ? 'Ukládám…' : 'Vytvořit klienta'}
          </button>
          <Link href="/clients" className="px-4 py-2 text-sm text-gray-600 dark:text-slate-400 hover:text-gray-900">Zrušit</Link>
        </div>
      </form>
    </div>
  )
}
