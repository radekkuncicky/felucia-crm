'use client'

import { useEffect, useId, useState } from 'react'
import { Field, Input, Select } from '@/components/ui/Field'
import { PRAZDNY_ZDROJ, type ZdrojHodnota, type ZdrojVolba } from '@/lib/zdrojPoptavkyHodnota'

export { PRAZDNY_ZDROJ, zdrojPayload, zdrojHodnota, type ZdrojHodnota, type ZdrojVolba } from '@/lib/zdrojPoptavkyHodnota'

let cache: Promise<ZdrojVolba[]> | null = null

/** Číselník zdrojů org (jednou za načtení stránky). */
export function useZdrojePoptavky(): ZdrojVolba[] {
  const [zdroje, setZdroje] = useState<ZdrojVolba[]>([])
  useEffect(() => {
    cache ??= fetch('/api/zdroje-poptavky')
      .then(r => (r.ok ? r.json() : []))
      .catch(() => [])
    let zivy = true
    cache.then(z => { if (zivy) setZdroje(z) })
    return () => { zivy = false }
  }, [])
  return zdroje
}

interface KlientNavrh { id: string; jmeno: string; prijmeni: string }
const nazevKlienta = (k: KlientNavrh) => `${k.jmeno} ${k.prijmeni}`.trim()

export default function ZdrojPoptavkyPole({ value, onChange, required, error, disabled, className }: {
  value: ZdrojHodnota
  onChange: (v: ZdrojHodnota) => void
  required?: boolean
  error?: string | null
  disabled?: boolean
  className?: string
}) {
  const zdroje = useZdrojePoptavky()
  const listId = useId()
  const [navrhy, setNavrhy] = useState<KlientNavrh[]>([])
  const vybrany = zdroje.find(z => z.id === value.zdrojPoptavkyId)
  const doporuceni = vybrany?.kod === 'DOPORUCENI'
  const hledat = value.doporucilKlientId ? '' : value.doporucilNazev.trim()

  // Návrhy klientů pro „kdo doporučil“ (vybraný se uloží jako vazba, jinak volný text)
  useEffect(() => {
    if (!doporuceni || hledat.length < 2) { setNavrhy([]); return }
    const ctrl = new AbortController()
    const t = setTimeout(() => {
      fetch(`/api/clients?search=${encodeURIComponent(hledat)}`, { signal: ctrl.signal })
        .then(r => (r.ok ? r.json() : []))
        .then((rows: KlientNavrh[]) => setNavrhy(Array.isArray(rows) ? rows.slice(0, 10) : []))
        .catch(() => {})
    }, 250)
    return () => { clearTimeout(t); ctrl.abort() }
  }, [doporuceni, hledat])

  return (
    <div className={className}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Odkud o nás ví" required={required} error={error} hint={!error ? 'Zdroj poptávky pro KPI' : undefined}>
          <Select
            value={value.zdrojPoptavkyId}
            disabled={disabled}
            onChange={e => onChange({ ...PRAZDNY_ZDROJ, zdrojPoptavkyId: e.target.value })}
          >
            <option value="">{required ? 'Vyberte…' : 'Neuvedeno'}</option>
            {zdroje.filter(z => z.aktivni || z.id === value.zdrojPoptavkyId).map(z => (
              <option key={z.id} value={z.id}>{z.nazev}</option>
            ))}
          </Select>
        </Field>
        {doporuceni && (
          <Field label="Kdo doporučil" hint={value.doporucilKlientId ? 'Klient z adresáře' : 'Klient z adresáře nebo volný text'}>
            <Input
              list={listId}
              value={value.doporucilNazev}
              disabled={disabled}
              placeholder="Jméno klienta…"
              onChange={e => {
                const text = e.target.value
                const klient = navrhy.find(k => nazevKlienta(k) === text)
                onChange({ ...value, doporucilNazev: text, doporucilKlientId: klient?.id ?? '' })
              }}
            />
            <datalist id={listId}>
              {navrhy.map(k => <option key={k.id} value={nazevKlienta(k)} />)}
            </datalist>
          </Field>
        )}
      </div>
    </div>
  )
}
