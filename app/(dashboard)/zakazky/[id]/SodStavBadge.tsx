'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDate } from '@/lib/format'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import type { SodStavZakazkyKod } from '@/lib/sodStavZakazky'

interface Props {
  zakazkaId: string
  kod: SodStavZakazkyKod
  label: string
  sodCislo: string | null
  /** ISO datum podpisu (online nebo papírového) */
  datum: string | null
  papirove: { datum: string; kdo: string | null } | null
  /** odkaz na Smlouvy v OP (jen s přístupem k obchodu) */
  opHref: string | null
  canEdit: boolean
}

const BARVY: Record<SodStavZakazkyKod, string> = {
  PODEPSANA: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  PODEPSANA_PAPIROVE: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ODESLANA: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  NEODESLANA: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  BEZ_SOD: 'bg-gray-100 text-gray-500 dark:bg-slate-700 dark:text-slate-400',
}


/** Stav smlouvy o dílo v hlavičce zakázky + ruční označení papírového podpisu. */
export default function SodStavBadge({ zakazkaId, kod, label, sodCislo, datum, papirove, opHref, canEdit }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  async function nastavPapirove(hodnota: boolean) {
    setSaving(true)
    try {
      const res = await api.patch(`/api/zakazky/${zakazkaId}`, { sodPapirove: hodnota }, {
        errorMessage: 'Stav smlouvy se nepodařilo uložit.',
      })
      if (res.ok) {
        setOpen(false)
        router.refresh()
      }
    } finally {
      setSaving(false)
    }
  }

  const badge = (
    <>
      <span className="font-semibold">SOD:</span> {label}
    </>
  )
  const badgeClass = cn('inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium', BARVY[kod])

  return (
    <>
      <button
        type="button"
        data-compact
        onClick={() => setOpen(true)}
        className={cn(badgeClass, 'hit-area hover:opacity-80 transition-opacity')}
        title="Stav smlouvy o dílo"
      >
        {badge}
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Smlouva o dílo"
        size="sm"
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {canEdit && kod !== 'PODEPSANA' && (
              papirove
                ? <Button variant="secondary" loading={saving} onClick={() => nastavPapirove(false)}>Zrušit papírový podpis</Button>
                : <Button loading={saving} onClick={() => nastavPapirove(true)}>Označit jako podepsanou papírově</Button>
            )}
            <Button variant="ghost" onClick={() => setOpen(false)}>Zavřít</Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-fg">
          <p><span className={badgeClass}>{label}</span></p>
          {sodCislo && <p>Smlouva: <span className="font-mono">{sodCislo}</span></p>}
          {datum && (kod === 'PODEPSANA' || kod === 'PODEPSANA_PAPIROVE') && <p>Podepsáno: {formatDate(datum)}</p>}
          {papirove && kod === 'PODEPSANA_PAPIROVE' && papirove.kdo && <p className="text-muted">Označil(a): {papirove.kdo}</p>}
          {kod === 'PODEPSANA' && papirove && (
            <p className="text-muted">Smlouva je podepsaná online — ruční papírový příznak není potřeba.</p>
          )}
          {kod === 'BEZ_SOD' && (
            <p className="text-muted">K obchodnímu případu zatím není smlouva ve Felucii. Pokud ji klient podepsal na papíře, označte to tady.</p>
          )}
          {opHref && (
            <p><Link href={opHref} className="text-green-700 dark:text-green-400 hover:underline">Otevřít smlouvy v obchodním případu →</Link></p>
          )}
        </div>
      </Dialog>
    </>
  )
}
