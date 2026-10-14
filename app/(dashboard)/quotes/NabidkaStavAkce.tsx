'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import ZapsatHovorDialog from '@/components/ZapsatHovorDialog'

/** Rychlé akce v přehledu „Visí odeslané“: zavolat (zapsat hovor), akceptovaná, odmítnutá (bez důvodu). */
export default function NabidkaStavAkce({ quoteId, telefon }: { quoteId: string; telefon: string | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [hovor, setHovor] = useState(false)

  async function zmenit(stav: 'AKCEPTOVANA' | 'ODMITNUTA') {
    setBusy(true)
    try {
      const res = await fetch(`/api/quotes/${quoteId}/stav`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stav }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error(data.error || 'Stav nabídky se nepodařilo změnit'); return }
      toast.success(stav === 'AKCEPTOVANA' ? 'Nabídka akceptována' : 'Nabídka odmítnuta')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-end">
      <Button size="sm" variant="soft-attention" onClick={() => setHovor(true)}>Zapsat hovor</Button>
      <Button size="sm" variant="ghost" className="text-green-700 dark:text-green-400" disabled={busy} onClick={() => zmenit('AKCEPTOVANA')}>Akceptovaná</Button>
      <Button size="sm" variant="ghost" className="text-red-600 dark:text-red-400" disabled={busy} onClick={() => zmenit('ODMITNUTA')}>Odmítnutá</Button>
      <ZapsatHovorDialog open={hovor} onClose={() => { setHovor(false); router.refresh() }} predvyplneni={{ telefon: telefon ?? '' }} />
    </div>
  )
}
