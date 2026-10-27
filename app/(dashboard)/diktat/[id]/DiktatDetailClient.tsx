'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Field, Input, Textarea } from '@/components/ui/Field'
import { confirmDialog } from '@/components/ui/confirm'
import { MikrofonButton, useDiktovani } from '@/components/DiktatDialog'
import { zpracujDiktatSDasou } from '@/lib/diktatDasa'
import { DIKTAT_MAX } from '@/lib/diktat'

interface Diktat {
  id: string
  text: string
  datum: string
  hotovo: boolean
  vytvoreno: string
  autor: string | null
}

/** Nezpracovaný diktát: úprava textu a termínu, zpracování s Dášou, hotovo / smazat */
export default function DiktatDetailClient({ diktat, maDasu }: { diktat: Diktat; maDasu: boolean }) {
  const router = useRouter()
  const [text, setText] = useState(diktat.text)
  const [datum, setDatum] = useState(diktat.datum)
  const [ukladam, setUkladam] = useState(false)
  const mic = useDiktovani(t => setText(prev => (prev ? `${prev} ${t}` : t).slice(0, DIKTAT_MAX)))
  const zmeneno = text !== diktat.text || datum !== diktat.datum

  async function ulozit(extra?: { hotovo: boolean }) {
    mic.stop()
    setUkladam(true)
    const res = await api.patch(`/api/diktat/${diktat.id}`, { ...(zmeneno ? { text, datum } : {}), ...extra }, { errorMessage: 'Diktát se nepodařilo uložit.' })
    setUkladam(false)
    if (!res.ok) return false
    router.refresh()
    return true
  }

  async function sDasou() {
    if (zmeneno && !(await ulozit())) return
    zpracujDiktatSDasou(diktat.id)
  }

  async function smazat() {
    if (!(await confirmDialog('Smazat tento diktát?', { danger: true, confirmLabel: 'Smazat' }))) return
    const res = await api.delete(`/api/activities/${diktat.id}`, { errorMessage: 'Diktát se nepodařilo smazat.' })
    if (res.ok) {
      toast.success('Diktát smazán')
      router.push('/dashboard')
    }
  }

  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader
        back={{ href: '/dashboard', label: 'Nástěnka' }}
        title="Diktát"
        description={`Nadiktováno ${formatDateTime(diktat.vytvoreno)}${diktat.autor ? ` · ${diktat.autor}` : ''}${diktat.hotovo ? ' · vyřízeno' : ''}`}
      />

      <div className="rounded-xl border border-line bg-surface p-4 sm:p-5 space-y-4">
        <Field label="Text diktátu">
          <Textarea rows={8} value={text} maxLength={DIKTAT_MAX} onChange={e => setText(e.target.value)} />
        </Field>
        <div className="flex flex-wrap items-end gap-3">
          {mic.podpora && <MikrofonButton nahravam={mic.nahravam} onClick={mic.nahravam ? mic.stop : mic.start} />}
          <Field label="Úkol na den" className="w-44">
            <Input type="date" value={datum} onChange={e => setDatum(e.target.value)} />
          </Field>
          {zmeneno && <Button variant="secondary" onClick={() => ulozit()} loading={ukladam}>Uložit změny</Button>}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {maDasu && !diktat.hotovo && <Button onClick={sDasou}>Zpracovat s Dášou</Button>}
        {diktat.hotovo
          ? <Button variant="secondary" onClick={() => ulozit({ hotovo: false })} loading={ukladam}>Vrátit mezi úkoly</Button>
          : <Button variant="secondary" onClick={async () => { if (await ulozit({ hotovo: true })) toast.success('Diktát vyřízen') }} loading={ukladam}>Vyřízeno bez dalšího</Button>}
        <Button variant="danger" onClick={smazat}>Smazat</Button>
      </div>
      {maDasu && !diktat.hotovo && (
        <p className="text-sm text-muted">
          Dáša z textu pozná, jestli jde o stávajícího klienta, lead nebo OP, navrhne co založit a po potvrzení diktát připojí — v historii pak zůstane jako hovor.
        </p>
      )}
    </div>
  )
}
