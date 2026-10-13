'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { IconButton } from '@/components/ui/IconButton'
import { Input } from '@/components/ui/Field'

interface Polozka {
  kod: string
  cislo: number
  nazev: string
  jednotka: string
  smer: 'VYSSI' | 'NIZSI'
  aktivni: boolean
  cil: number | null
  poradi: number
  dostupne: boolean
  faze: number
}

export default function KpiNastaveniClient({ polozky: initial }: { polozky: Polozka[] }) {
  const router = useRouter()
  const [polozky, setPolozky] = useState(initial.map(p => ({ ...p, cilText: p.cil === null ? '' : String(p.cil).replace('.', ',') })))
  const [ukladam, setUkladam] = useState(false)

  function zmen(i: number, patch: Partial<(typeof polozky)[number]>) {
    setPolozky(prev => prev.map((p, j) => (j === i ? { ...p, ...patch } : p)))
  }
  function posun(i: number, o: number) {
    setPolozky(prev => {
      const j = i + o
      if (j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }

  async function uloz() {
    setUkladam(true)
    try {
      const res = await fetch('/api/kpi/nastaveni', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          polozky: polozky.map((p, i) => ({
            kod: p.kod, aktivni: p.aktivni, poradi: i + 1,
            cil: p.cilText.trim() === '' ? null : Number(p.cilText.replace(/\s/g, '').replace(',', '.')),
          })),
        }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(d.error ?? 'Uložení selhalo'); return }
      toast.success('Nastavení KPI uloženo')
      router.refresh()
    } finally { setUkladam(false) }
  }

  return (
    <div className="space-y-4">
      <ul className="rounded-xl border border-line bg-surface divide-y divide-line">
        {polozky.map((p, i) => (
          <li key={p.kod} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center">
            <label className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer">
              <input
                type="checkbox"
                checked={p.aktivni}
                onChange={e => zmen(i, { aktivni: e.target.checked })}
                className="w-5 h-5 accent-[#4CAF50] shrink-0"
              />
              <span className="min-w-0">
                <span className="block text-sm font-medium text-fg">{p.cislo}. {p.nazev}</span>
                <span className="block text-xs text-muted">
                  {p.dostupne ? 'Počítá se z dat CRM' : `Bez dat — fáze ${p.faze}`}
                </span>
              </span>
            </label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted w-10 text-right">{p.smer === 'VYSSI' ? 'min.' : 'max.'}</span>
              <Input
                kind="castka"
                aria-label={`Cíl ${p.nazev}`}
                value={p.cilText}
                onChange={e => zmen(i, { cilText: e.target.value })}
                placeholder="bez cíle"
                className="w-28"
              />
              <span className="text-xs text-muted w-6">{p.jednotka}</span>
              <IconButton label="Posunout výš" onClick={() => posun(i, -1)} disabled={i === 0}>↑</IconButton>
              <IconButton label="Posunout níž" onClick={() => posun(i, 1)} disabled={i === polozky.length - 1}>↓</IconButton>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex justify-end">
        <Button onClick={uloz} loading={ukladam}>Uložit</Button>
      </div>
    </div>
  )
}
