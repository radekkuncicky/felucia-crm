'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { confirmDialog } from '@/components/ui/confirm'

interface Polozka { id: string; nazev: string; pripojeno: string; naposledy: string | null }

export default function KonektoryClient({ polozky }: { polozky: Polozka[] }) {
  const router = useRouter()
  const [rusi, setRusi] = useState<string | null>(null)

  async function zrus(p: Polozka) {
    const ok = await confirmDialog(
      'Aplikace okamžitě ztratí přístup k Felucii. Znovu ji připojíte přidáním konektoru v aplikaci.',
      { title: `Odpojit „${p.nazev}“?`, confirmLabel: 'Odpojit', danger: true },
    )
    if (!ok) return
    setRusi(p.id)
    try {
      await fetch(`/api/settings/konektory/${p.id}`, { method: 'DELETE' })
      router.refresh()
    } finally {
      setRusi(null)
    }
  }

  if (polozky.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface p-8 text-center text-sm text-muted">
        Žádná připojená aplikace.
      </div>
    )
  }

  return (
    <ul className="rounded-xl border border-line bg-surface divide-y divide-[var(--line)]">
      {polozky.map(p => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="min-w-0">
            <div className="font-medium text-fg truncate">{p.nazev}</div>
            <div className="text-xs text-muted">
              Připojeno {p.pripojeno}{p.naposledy ? ` · naposledy ${p.naposledy}` : ''}
            </div>
          </div>
          <Button variant="secondary" size="sm" loading={rusi === p.id} onClick={() => zrus(p)}>Odpojit</Button>
        </li>
      ))}
    </ul>
  )
}
