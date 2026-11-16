'use client'

import { useEffect, useState } from 'react'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { Field, Input } from '@/components/ui/Field'

/**
 * Ruční připojení diktátu: hledání OP (číslo, klient, předmět) nebo leadu.
 * Po potvrzení PATCH /api/diktat/[id] { dealId } | { leadId } → onHotovo(href).
 */

type Druh = 'OP' | 'LEAD'
interface Volba { id: string; label: string }

interface DealRow { id: string; kod: string | null; predmet: string | null; client: { jmeno: string; prijmeni: string | null } | null }
interface LeadRow { id: string; jmeno: string; firma: string | null; status: string }

export default function PripojitDiktatDialog({ diktatId, open, onClose, onHotovo, maLeady }: {
  diktatId: string
  open: boolean
  onClose: () => void
  onHotovo: (href: string) => void
  maLeady: boolean
}) {
  const [druh, setDruh] = useState<Druh>('OP')
  const [q, setQ] = useState('')
  const [vysledky, setVysledky] = useState<Volba[] | null>(null)
  const [vybrano, setVybrano] = useState<Volba | null>(null)
  const [ukladam, setUkladam] = useState(false)

  useEffect(() => { if (open) { setQ(''); setVybrano(null); setVysledky(null) } }, [open, druh])

  useEffect(() => {
    if (!open) return
    let zruseno = false
    const t = setTimeout(async () => {
      if (druh === 'OP') {
        const res = await api.get<DealRow[]>(`/api/deals?search=${encodeURIComponent(q.trim())}`, { silent: true })
        if (zruseno) return
        setVysledky((res.ok && res.data ? res.data : []).slice(0, 12).map(d => ({
          id: d.id,
          label: [d.kod, d.client ? `${d.client.jmeno} ${d.client.prijmeni ?? ''}`.trim() : null, d.predmet].filter(Boolean).join(' · '),
        })))
      } else {
        const res = await api.get<LeadRow[]>(`/api/leady?search=${encodeURIComponent(q.trim())}`, { silent: true })
        if (zruseno) return
        setVysledky((res.ok && Array.isArray(res.data) ? res.data : [])
          .filter(l => l.status !== 'PREVEDEN' && l.status !== 'ZRUSEN')
          .slice(0, 12)
          .map(l => ({ id: l.id, label: [l.jmeno, l.firma].filter(Boolean).join(' · ') })))
      }
    }, 250)
    return () => { zruseno = true; clearTimeout(t) }
  }, [open, druh, q])

  async function pripojit() {
    if (!vybrano) return
    setUkladam(true)
    const res = await api.patch<{ href?: string }>(
      `/api/diktat/${diktatId}`,
      druh === 'OP' ? { dealId: vybrano.id } : { leadId: vybrano.id },
      { errorMessage: 'Diktát se nepodařilo připojit.' },
    )
    setUkladam(false)
    if (res.ok) onHotovo(res.data?.href ?? (druh === 'OP' ? `/deals/${vybrano.id}` : `/leady/${vybrano.id}`))
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Připojit diktát"
      size="lg"
      footer={<>
        <Button variant="secondary" onClick={onClose}>Zrušit</Button>
        <Button onClick={pripojit} disabled={!vybrano} loading={ukladam}>Připojit</Button>
      </>}
    >
      <div className="space-y-4">
        {maLeady && (
          <div className="flex gap-2" role="tablist">
            {(['OP', 'LEAD'] as const).map(d => (
              <Button key={d} size="sm" variant={druh === d ? 'primary' : 'secondary'} role="tab" aria-selected={druh === d} onClick={() => setDruh(d)}>
                {d === 'OP' ? 'K obchodnímu případu' : 'K leadu'}
              </Button>
            ))}
          </div>
        )}
        <Field label={druh === 'OP' ? 'Hledat OP (číslo, klient, předmět)' : 'Hledat lead (jméno, firma, telefon)'}>
          <Input autoFocus value={q} onChange={e => setQ(e.target.value)} placeholder="např. Novák" />
        </Field>
        <ul className="max-h-72 overflow-y-auto divide-y divide-line rounded-lg border border-line">
          {vysledky === null && <li className="p-3 text-sm text-muted">Hledám…</li>}
          {vysledky?.length === 0 && <li className="p-3 text-sm text-muted">Nic nenalezeno.</li>}
          {vysledky?.map(v => (
            <li key={v.id}>
              <button
                type="button"
                onClick={() => setVybrano(v)}
                aria-pressed={vybrano?.id === v.id}
                className={cn(
                  'w-full text-left px-3 py-2.5 text-sm text-fg hover:bg-surface-2',
                  vybrano?.id === v.id && 'bg-primary/10 font-medium',
                )}
              >
                {v.label || '(bez názvu)'}
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Diktát se v historii {druh === 'OP' ? 'obchodního případu' : 'leadu'} objeví jako hovor (diktát z appky Sales jako zápis z jednání) s datem nadiktování.
        </p>
      </div>
    </Dialog>
  )
}
