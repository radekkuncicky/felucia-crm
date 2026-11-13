'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Field, Select } from '@/components/ui/Field'
import { IconButton } from '@/components/ui/IconButton'
import { confirmDialog } from '@/components/ui/confirm'
import { formatDateTime } from '@/lib/format'

export interface EtapaVolba { id: string; cislo: number; nazev: string | null; stav: string }
export interface UlozenyProtokol {
  id: string
  nazev: string
  url: string
  vytvoreno: string
  nahral: string | null
  etapaId: string | null
}

export const etapaNazev = (e: EtapaVolba) => `Etapa ${e.cislo}${e.nazev ? ` – ${e.nazev}` : ''}`

/** Výchozí etapa pro nový protokol: první nepředaná, jinak poslední. */
export function vychoziEtapaId(etapy: EtapaVolba[]): string {
  if (etapy.length === 0) return ''
  return (etapy.find((e) => e.stav !== 'PREDANA') ?? etapy[etapy.length - 1]).id
}

/** Výběr etapy v dialogu protokolu — jen když má zakázka etapy. */
export function EtapaVyber({ etapy, value, onChange }: { etapy: EtapaVolba[]; value: string; onChange: (v: string) => void }) {
  if (etapy.length === 0) return null
  return (
    <Field label="Etapa" hint="Protokol se uloží k této etapě.">
      <Select value={value} onChange={(e) => onChange(e.target.value)}>
        {etapy.map((e) => <option key={e.id} value={e.id}>{etapaNazev(e)}</option>)}
        <option value="">Celá zakázka (bez etapy)</option>
      </Select>
    </Field>
  )
}

/** Seznam uložených PDF protokolu (seskupený podle etap) — stažení, smazání. */
export function UlozeneProtokoly({ zakazkaId, protokoly, etapy, canDelete }: {
  zakazkaId: string
  protokoly: UlozenyProtokol[]
  etapy: EtapaVolba[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [mazani, setMazani] = useState<string | null>(null)
  if (protokoly.length === 0) return null

  const skupiny: { klic: string; nadpis: string | null; polozky: UlozenyProtokol[] }[] = []
  if (etapy.length > 0) {
    for (const e of etapy) {
      const polozky = protokoly.filter((p) => p.etapaId === e.id)
      if (polozky.length) skupiny.push({ klic: e.id, nadpis: etapaNazev(e), polozky })
    }
    const bez = protokoly.filter((p) => !p.etapaId || !etapy.some((e) => e.id === p.etapaId))
    if (bez.length) skupiny.push({ klic: 'bez', nadpis: 'Bez etapy', polozky: bez })
  } else {
    skupiny.push({ klic: 'vse', nadpis: null, polozky: protokoly })
  }

  async function smazat(p: UlozenyProtokol) {
    if (!(await confirmDialog(`Smazat „${p.nazev}“?`, { confirmLabel: 'Smazat', danger: true }))) return
    setMazani(p.id)
    try {
      const res = await fetch(`/api/zakazky/${zakazkaId}/podklady/${p.id}`, { method: 'DELETE' })
      if (!res.ok) { toast.error('Protokol se nepodařilo smazat'); return }
      toast.success('Protokol smazán')
      router.refresh()
    } finally {
      setMazani(null)
    }
  }

  return (
    <div className="border-t border-line pt-2 space-y-2">
      {skupiny.map((s) => (
        <div key={s.klic}>
          {s.nadpis && <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">{s.nadpis}</p>}
          <ul className="space-y-1">
            {s.polozky.map((p) => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <svg className="w-4 h-4 shrink-0 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" />
                </svg>
                <a href={p.url} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-primary hover:underline">
                  {p.nazev}
                </a>
                <span className="hidden sm:inline text-xs text-muted whitespace-nowrap">
                  {formatDateTime(p.vytvoreno)}{p.nahral ? ` · ${p.nahral}` : ''}
                </span>
                <a href={p.url} download className="text-xs font-medium text-primary hover:underline whitespace-nowrap">Stáhnout</a>
                {canDelete && (
                  <IconButton label={`Smazat ${p.nazev}`} tone="danger" disabled={mazani === p.id} onClick={() => smazat(p)}>
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                    </svg>
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
