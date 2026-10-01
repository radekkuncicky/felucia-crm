'use client'

// C5: jeden formulář „nový klient" pro /clients/new, inline založení
// (ClientSelectWithCreate) i rychlou cenovku. Shodné pořadí polí:
// typ → (Firma: ARES/IČO → název → DIČ → kontaktní osoba | Osoba: jméno, příjmení)
// → telefon → e-mail → adresa (→ poznámka v plné variantě).

import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { confirmDialog } from '@/components/ui/confirm'
import AresAutocomplete from '@/components/AresAutocomplete'
import type { AresFirma } from '@/hooks/useAresLookup'
import { parseEmailInput } from '@/lib/parseEmail'
import { cn } from '@/lib/cn'

export type TypKlienta = 'FYZICKA_OSOBA' | 'FIRMA'

export interface ClientFormData {
  typKlienta: TypKlienta
  /** Osoba: křestní jméno · Firma: název firmy */
  jmeno: string
  /** Osoba: příjmení · Firma: kontaktní osoba */
  prijmeni: string
  telefon: string
  email: string
  ico: string
  dic: string
  ulice: string
  mesto: string
  psc: string
  poznamka: string
}

export const PRAZDNY_KLIENT: ClientFormData = {
  typKlienta: 'FYZICKA_OSOBA',
  jmeno: '', prijmeni: '', telefon: '', email: '',
  ico: '', dic: '', ulice: '', mesto: '', psc: '', poznamka: '',
}

export interface DuplicitniKlient {
  id: string
  jmeno: string
  prijmeni: string
  telefon: string | null
  email: string | null
}

/** Chybová hláška, nebo null když je formulář v pořádku */
export function validateClient(d: ClientFormData): string | null {
  if (d.typKlienta === 'FIRMA') return d.jmeno.trim() ? null : 'Název firmy je povinný'
  return d.prijmeni.trim() ? null : 'Příjmení je povinné'
}

/** Tělo pro POST /api/clients */
export function clientPayload(d: ClientFormData) {
  const firma = d.typKlienta === 'FIRMA'
  return {
    typKlienta: d.typKlienta,
    jmeno: d.jmeno.trim(),
    prijmeni: d.prijmeni.trim(),
    telefon: d.telefon.trim() || null,
    email: d.email.trim() || null,
    ulice: d.ulice.trim() || null,
    mesto: d.mesto.trim() || null,
    psc: d.psc.trim() || null,
    ico: firma ? d.ico.trim() || null : null,
    dic: firma ? d.dic.trim() || null : null,
    poznamka: d.poznamka.trim() || null,
  }
}

/**
 * Kontrola duplicity před založením. Vrátí existujícího klienta, pokud ho uživatel
 * chce použít; null = zakládat nového (žádná shoda nebo „jde o jiného").
 */
export async function najdiDuplicitu(d: ClientFormData, confirmLabel = 'Ano, použít tohoto klienta'): Promise<DuplicitniKlient | null> {
  try {
    const res = await fetch('/api/clients/check-duplicate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jmeno: d.jmeno, prijmeni: d.prijmeni, telefon: d.telefon, email: d.email }),
    })
    if (!res.ok) return null
    const { match } = await res.json() as { match: DuplicitniKlient | null }
    if (!match) return null
    const popis = [`${match.jmeno} ${match.prijmeni}`.trim(), match.telefon, match.email].filter(Boolean).join(' · ')
    const pouzit = await confirmDialog(popis, {
      title: 'Nemyslíte náhodou tohoto klienta?',
      confirmLabel,
      cancelLabel: 'Ne, jde o jiného',
      danger: false,
    })
    return pouzit ? match : null
  } catch {
    return null
  }
}

/** „Školní 27, 736 01 Havířov" → ulice / PSČ / město */
export function parseFullAddress(text: string): { ulice: string; psc: string; mesto: string } | null {
  const match = text.trim().match(/^(.+?),?\s+(\d{3}\s?\d{2})\s+(.+)$/)
  if (!match) return null
  const pscRaw = match[2].replace(/\s/g, '')
  return { ulice: match[1].trim(), psc: `${pscRaw.slice(0, 3)} ${pscRaw.slice(3)}`, mesto: match[3].trim() }
}

interface Props {
  value: ClientFormData
  onChange: (next: ClientFormData) => void
  /** full = /clients/new (ARES vyhledávání podle názvu, poznámka); compact = dialog / cenovka */
  variant?: 'full' | 'compact'
}

export default function ClientFormFields({ value: d, onChange, variant = 'full' }: Props) {
  const full = variant === 'full'
  const firma = d.typKlienta === 'FIRMA'
  const [aresLoading, setAresLoading] = useState(false)
  const [adresaHint, setAdresaHint] = useState(false)

  const set = (patch: Partial<ClientFormData>) => onChange({ ...d, ...patch })

  // Přepnutí typu: text osoby („Novák Jan") patří do názvu firmy a zpět
  function zmenitTyp(typ: TypKlienta) {
    if (typ === d.typKlienta) return
    set(typ === 'FIRMA'
      ? { typKlienta: typ, jmeno: [d.prijmeni, d.jmeno].filter(Boolean).join(' '), prijmeni: '' }
      : { typKlienta: typ, prijmeni: d.jmeno, jmeno: '' })
  }

  function prevzitZAres(f: AresFirma) {
    set({
      typKlienta: 'FIRMA',
      jmeno: f.nazev.trim() || d.jmeno,
      ico: f.ico || d.ico,
      dic: f.dic ?? d.dic,
      ulice: f.ulice || d.ulice,
      mesto: f.mesto || d.mesto,
      psc: f.psc || d.psc,
    })
  }

  // Přes vlastní /api/ares — přímé volání ares.gov.cz z prohlížeče blokuje CSP
  async function nacistAres() {
    const ico = d.ico.trim()
    if (!ico) return
    setAresLoading(true)
    try {
      const res = await fetch(`/api/ares?q=${encodeURIComponent(ico)}`)
      const firmy = res.ok ? await res.json() as AresFirma[] : []
      if (!firmy.length) { toast.error('IČO nenalezeno v ARES'); return }
      prevzitZAres(firmy[0])
    } catch {
      toast.error('Nepodařilo se načíst data z ARES')
    } finally {
      setAresLoading(false)
    }
  }

  const gap = full ? 'gap-4' : 'gap-3'

  return (
    <div className={cn('flex flex-col', gap)}>
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-slate-700 rounded-lg w-fit" role="group" aria-label="Typ klienta">
        {(['FYZICKA_OSOBA', 'FIRMA'] as TypKlienta[]).map(typ => (
          <button
            key={typ}
            type="button"
            data-compact
            aria-pressed={d.typKlienta === typ}
            onClick={() => zmenitTyp(typ)}
            className={cn(
              'hit-area px-4 py-1.5 rounded-md text-sm font-medium transition-colors',
              d.typKlienta === typ
                ? 'bg-white dark:bg-slate-600 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200',
            )}
          >
            {typ === 'FYZICKA_OSOBA' ? 'Fyzická osoba' : 'Firma'}
          </button>
        ))}
      </div>

      {firma ? (
        <>
          {full && (
            <div>
              <p className="block text-sm font-medium text-gray-700 dark:text-slate-300 mb-1">Vyhledat firmu v ARES</p>
              <AresAutocomplete onSelect={prevzitZAres} />
              <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">Zadejte název firmy nebo IČO — po výběru se pole vyplní automaticky</p>
            </div>
          )}
          <div className={cn('grid grid-cols-1 sm:grid-cols-2', gap)}>
            <Field label="IČO">
              <div className="flex gap-2">
                <Input kind="ico" value={d.ico} onChange={e => set({ ico: e.target.value })} placeholder="12345678" />
                <Button variant="secondary" onClick={nacistAres} disabled={!d.ico.trim()} loading={aresLoading} title="Načíst údaje z ARES podle IČO">
                  ARES
                </Button>
              </div>
            </Field>
            <Field label="DIČ">
              <Input value={d.dic} onChange={e => set({ dic: e.target.value })} placeholder="CZ12345678" />
            </Field>
          </div>
          <Field label="Název firmy" required>
            <Input value={d.jmeno} onChange={e => set({ jmeno: e.target.value })} placeholder="Vzorová stavba s.r.o." autoComplete="organization" />
          </Field>
          <Field label="Kontaktní osoba">
            <Input value={d.prijmeni} onChange={e => set({ prijmeni: e.target.value })} placeholder="Jan Novák" autoComplete="name" />
          </Field>
        </>
      ) : (
        <div className={cn('grid grid-cols-1 sm:grid-cols-2', gap)}>
          <Field label="Jméno">
            <Input value={d.jmeno} onChange={e => set({ jmeno: e.target.value })} placeholder="Karel" autoComplete="given-name" />
          </Field>
          <Field label="Příjmení" required>
            <Input value={d.prijmeni} onChange={e => set({ prijmeni: e.target.value })} placeholder="Novák" autoComplete="family-name" />
          </Field>
        </div>
      )}

      <div className={cn('grid grid-cols-1 sm:grid-cols-2', gap)}>
        <Field label="Telefon">
          <Input kind="tel" value={d.telefon} onChange={e => set({ telefon: e.target.value })} placeholder="+420 …" />
        </Field>
        <Field label="E-mail">
          <Input
            kind="email"
            value={d.email}
            onChange={e => set({ email: e.target.value })}
            onPaste={e => {
              const text = e.clipboardData.getData('text')
              const parsed = parseEmailInput(text)
              if (parsed !== text) { e.preventDefault(); set({ email: parsed }) }
            }}
            onBlur={e => set({ email: parseEmailInput(e.target.value) })}
          />
        </Field>
      </div>

      <Field label="Ulice a číslo popisné" hint={adresaHint ? '✓ Adresa rozpoznána a rozdělena do polí' : undefined}>
        <Input
          value={d.ulice}
          onChange={e => set({ ulice: e.target.value })}
          onPaste={e => {
            const parsed = parseFullAddress(e.clipboardData.getData('text'))
            if (parsed) {
              e.preventDefault()
              set(parsed)
              setAdresaHint(true)
              setTimeout(() => setAdresaHint(false), 3000)
            }
          }}
          autoComplete="street-address"
          placeholder="Nebo vložte celou adresu, např. Školní 27, 736 01 Havířov"
        />
      </Field>
      <div className={cn('grid grid-cols-1 sm:grid-cols-3', gap)}>
        <Field label="Město" className="sm:col-span-2">
          <Input value={d.mesto} onChange={e => set({ mesto: e.target.value })} autoComplete="address-level2" />
        </Field>
        <Field label="PSČ">
          <Input kind="psc" value={d.psc} onChange={e => set({ psc: e.target.value })} placeholder="700 00" />
        </Field>
      </div>

      {full && (
        <Field label="Poznámka">
          <Textarea value={d.poznamka} onChange={e => set({ poznamka: e.target.value })} rows={3} placeholder="Interní poznámka ke klientovi…" />
        </Field>
      )}
    </div>
  )
}
