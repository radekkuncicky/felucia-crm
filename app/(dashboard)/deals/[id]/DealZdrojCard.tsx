'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import ZdrojPoptavkyPole, { zdrojPayload, type ZdrojHodnota } from '@/components/ZdrojPoptavkyPole'

/** Zdroj poptávky OP (KPI 6) — zobrazení a úprava v detailu OP. */
export default function DealZdrojCard({ dealId, nazev, doporucil, hodnota, canEdit }: {
  dealId: string
  nazev: string | null
  doporucil: string | null
  hodnota: ZdrojHodnota
  canEdit: boolean
}) {
  const router = useRouter()
  const [edit, setEdit] = useState(false)
  const [value, setValue] = useState(hodnota)
  const [saving, setSaving] = useState(false)

  async function uloz() {
    setSaving(true)
    try {
      const res = await fetch(`/api/deals/${dealId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(zdrojPayload(value)),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        toast.error(body?.error ?? 'Uložení se nezdařilo')
        return
      }
      setEdit(false)
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase">Odkud o nás ví</p>
        {canEdit && !edit && (
          <Button variant="link" size="sm" onClick={() => { setValue(hodnota); setEdit(true) }}>
            {nazev ? 'Změnit' : 'Doplnit'}
          </Button>
        )}
      </div>
      {edit ? (
        <div className="space-y-3 mt-2">
          <ZdrojPoptavkyPole value={value} onChange={setValue} />
          <div className="flex gap-2">
            <Button size="sm" onClick={uloz} loading={saving}>Uložit</Button>
            <Button size="sm" variant="ghost" onClick={() => setEdit(false)}>Zrušit</Button>
          </div>
        </div>
      ) : (
        <p className="font-medium text-gray-900 dark:text-white">
          {nazev ?? <span className="font-normal text-gray-400 dark:text-slate-500">Neuvedeno</span>}
          {doporucil && <span className="font-normal text-gray-500 dark:text-slate-400"> · doporučil {doporucil}</span>}
        </p>
      )}
    </div>
  )
}
