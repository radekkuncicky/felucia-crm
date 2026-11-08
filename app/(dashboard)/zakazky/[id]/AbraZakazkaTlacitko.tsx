'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/format'

interface Odpoved {
  stav: 'EXISTUJE' | 'DOPLNENA_FIRMA' | 'NANECISTO' | 'ZALOZENO'
  kod: string
  nazev: string
  odberatel: string
  adresarNovy: boolean
  existovala: boolean
  abraId: number | null
}

interface Props {
  zakazkaId: string
  /** ISO datum odeslání, null = ještě není v ABRA */
  odeslano: string | null
  abraId: number | null
}

/** F2: ruční založení zakázky (i s odběratelem) v ABRA Flexi — náhled nanečisto, pak ostrý zápis */
export default function AbraZakazkaTlacitko({ zakazkaId, odeslano, abraId }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [nahled, setNahled] = useState<Odpoved | null>(null)
  const [chyba, setChyba] = useState<string | null>(null)
  const [nacitam, setNacitam] = useState(false)
  const [zapisuju, setZapisuju] = useState(false)

  async function posli(dryRun: boolean): Promise<Odpoved | null> {
    const res = await fetch(`/api/zakazky/${zakazkaId}/abra`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dryRun }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      setChyba(data.error ?? `Chyba ${res.status}`)
      return null
    }
    return data as Odpoved
  }

  async function otevri() {
    setOpen(true)
    setNahled(null)
    setChyba(null)
    setNacitam(true)
    try {
      setNahled(await posli(true))
    } catch {
      setChyba('Spojení se nepodařilo')
    } finally {
      setNacitam(false)
    }
  }

  async function zapis() {
    setZapisuju(true)
    setChyba(null)
    try {
      const r = await posli(false)
      if (r) {
        toast.success(r.stav === 'ZALOZENO' ? `Zakázka ${r.kod} založena v ABRA` : `Zakázka ${r.kod} propojena s ABRA`)
        setOpen(false)
        router.refresh()
      }
    } catch {
      setChyba('Spojení se nepodařilo')
    } finally {
      setZapisuju(false)
    }
  }

  if (odeslano) {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
        title={abraId ? `ABRA Flexi zakázka id ${abraId}` : undefined}
      >
        V ABRA ✓ <span className="font-normal text-muted">{formatDate(odeslano)}</span>
      </span>
    )
  }

  const coSeStane = !nahled ? null
    : nahled.stav === 'EXISTUJE' ? 'Zakázka s tímto kódem už ve Flexi je i s odběratelem — jen se propojí, nic se nezapíše.'
    : nahled.existovala ? 'Zakázka s tímto kódem už ve Flexi je, ale bez odběratele — odběratel se doplní.'
    : 'Ve Flexi se založí nová zakázka ve stavu MÁME.'

  return (
    <>
      <Button variant="secondary" size="sm" onClick={otevri}>Založit v ABRA</Button>
      <Dialog
        open={open}
        onClose={() => !zapisuju && setOpen(false)}
        title="Založit zakázku v ABRA Flexi"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={zapisuju}>Zrušit</Button>
            <Button onClick={zapis} loading={zapisuju} disabled={!nahled || nacitam}>
              {nahled?.stav === 'EXISTUJE' ? 'Propojit' : 'Zapsat do ABRA'}
            </Button>
          </>
        }
      >
        {nacitam && <p className="text-sm text-muted">Ověřuji ve Flexi nanečisto…</p>}
        {chyba && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{chyba}</p>}
        {nahled && (
          <div className="space-y-3 text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
              <dt className="text-muted">Kód</dt><dd className="font-mono text-fg">{nahled.kod}</dd>
              <dt className="text-muted">Název</dt><dd className="text-fg">{nahled.nazev}</dd>
              <dt className="text-muted">Odběratel</dt>
              <dd className="text-fg">
                {nahled.odberatel}
                {nahled.stav !== 'EXISTUJE' && (
                  <span className="text-muted"> · {nahled.adresarNovy ? 'nový záznam v adresáři' : 'už v adresáři'}</span>
                )}
              </dd>
            </dl>
            <p className="text-fg">{coSeStane}</p>
            <p className="text-xs text-muted">Zapisuje se do ostrého účetnictví. Stav zakázky ve Flexi Felucia dál nemění, faktury se nevystavují.</p>
          </div>
        )}
      </Dialog>
    </>
  )
}
