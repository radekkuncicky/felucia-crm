'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { formatDateTime } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button, ButtonLink } from '@/components/ui/Button'
import EmptyState from '@/components/ui/EmptyState'
import PripojitDiktatDialog from '@/components/PripojitDiktatDialog'
import { zpracujDiktatSDasou } from '@/lib/diktatDasa'
import type { DiktatNavrh } from '@/lib/diktatNavrh'

export interface DiktatRadek {
  id: string
  text: string
  vytvoreno: string
  autor: string | null
  /** nadiktoval někdo jiný (vidí vedení) */
  cizi: boolean
  /** z appky Sales (k OP se připojí jako zápis z jednání) */
  zAppky: boolean
  navrhy: DiktatNavrh[]
}

const DLOUHY = 280

function DiktatKarta({ d, maLeady, maDasu, vyrizeny }: { d: DiktatRadek; maLeady: boolean; maDasu: boolean; vyrizeny?: boolean }) {
  const router = useRouter()
  const [cely, setCely] = useState(d.text.length <= DLOUHY)
  const [dialog, setDialog] = useState(false)
  const [pracuji, setPracuji] = useState<string | null>(null)

  function hotovo(href: string) {
    setDialog(false)
    toast.success('Diktát připojen', { action: { label: 'Otevřít', onClick: () => router.push(href) } })
    router.refresh()
  }

  async function pripojitNavrh(n: DiktatNavrh) {
    setPracuji(n.id)
    const res = await api.patch<{ href?: string }>(`/api/diktat/${d.id}`, n.druh === 'OP' ? { dealId: n.id } : { leadId: n.id }, { errorMessage: 'Diktát se nepodařilo připojit.' })
    setPracuji(null)
    if (res.ok) hotovo(res.data?.href ?? (n.druh === 'OP' ? `/deals/${n.id}` : `/leady/${n.id}`))
  }

  async function nastavHotovo(h: boolean) {
    setPracuji('hotovo')
    const res = await api.patch(`/api/diktat/${d.id}`, { hotovo: h }, { errorMessage: 'Diktát se nepodařilo uložit.' })
    setPracuji(null)
    if (res.ok) {
      toast.success(h ? 'Diktát vyřízen' : 'Diktát vrácen ke zpracování')
      router.refresh()
    }
  }

  return (
    <li className={cn('rounded-xl border border-line bg-surface p-4 sm:p-5 space-y-3', vyrizeny && 'opacity-75')}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>{formatDateTime(d.vytvoreno)}</span>
        {d.autor && <span>· {d.autor}</span>}
        {d.zAppky && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-fg">z appky Sales</span>}
        <Link href={`/diktat/${d.id}`} className="ml-auto text-primary hover:underline">Upravit</Link>
      </div>

      <p className="whitespace-pre-line text-sm text-fg leading-relaxed">
        {cely ? d.text : `${d.text.slice(0, DLOUHY).trimEnd()}…`}
        {!cely && (
          <button type="button" onClick={() => setCely(true)} className="ml-1 text-primary hover:underline">celé</button>
        )}
      </p>

      {!vyrizeny && d.navrhy.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-muted">Návrh, kam patří</div>
          <div className="flex flex-wrap gap-2">
            {d.navrhy.map(n => (
              <Button
                key={`${n.druh}-${n.id}`}
                size="sm"
                variant="secondary"
                loading={pracuji === n.id}
                disabled={!!pracuji}
                onClick={() => pripojitNavrh(n)}
                title={`Shoda podle: ${n.duvod}`}
              >
                <span className="text-muted">{n.druh === 'OP' ? 'OP' : 'Lead'}</span>
                <span className="truncate max-w-[16rem]">{n.label}</span>
                <span className="text-[11px] text-muted">({n.duvod})</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        {vyrizeny ? (
          <Button size="sm" variant="secondary" onClick={() => nastavHotovo(false)} loading={pracuji === 'hotovo'}>Vrátit ke zpracování</Button>
        ) : (
          <>
            <Button size="sm" onClick={() => setDialog(true)} disabled={!!pracuji}>Připojit k OP{maLeady ? ' / leadu' : ''}…</Button>
            {maDasu && <Button size="sm" variant="secondary" onClick={() => zpracujDiktatSDasou(d.id)} disabled={!!pracuji}>Založit s Dášou</Button>}
            <Button size="sm" variant="ghost" onClick={() => nastavHotovo(true)} loading={pracuji === 'hotovo'} disabled={!!pracuji && pracuji !== 'hotovo'}>Vyřízeno</Button>
          </>
        )}
      </div>

      {!vyrizeny && (
        <PripojitDiktatDialog diktatId={d.id} open={dialog} onClose={() => setDialog(false)} onHotovo={hotovo} maLeady={maLeady} />
      )}
    </li>
  )
}

export default function DiktatyClient({ nezpracovane, vyrizene, vidiVse, maLeady, maDasu }: {
  nezpracovane: DiktatRadek[]
  vyrizene: DiktatRadek[]
  vidiVse: boolean
  maLeady: boolean
  maDasu: boolean
}) {
  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title="Diktáty ke zpracování"
        description={
          vidiVse
            ? 'Diktáty všech obchodníků z appky Sales i z webu, které ještě nepatří k žádnému OP ani leadu.'
            : 'Vaše diktáty z appky Sales i z webu, které ještě nepatří k žádnému OP ani leadu.'
        }
        actions={<ButtonLink href="/dashboard" variant="secondary" size="sm">Nástěnka</ButtonLink>}
      />

      {nezpracovane.length === 0 ? (
        <div className="rounded-xl border border-line bg-surface">
          <EmptyState
            title="Vše zpracováno"
            description="Nový diktát z appky Sales (Dnes → Diktát) nebo z webu se objeví tady, dokud ho nepřipojíte k OP nebo leadu."
          />
        </div>
      ) : (
        <ul className="space-y-3">
          {nezpracovane.map(d => <DiktatKarta key={d.id} d={d} maLeady={maLeady} maDasu={maDasu} />)}
        </ul>
      )}

      {vyrizene.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer select-none text-sm font-medium text-muted hover:text-fg">
            Vyřízené bez připojení za posledních 30 dní ({vyrizene.length})
          </summary>
          <ul className="mt-3 space-y-3">
            {vyrizene.map(d => <DiktatKarta key={d.id} d={d} maLeady={maLeady} maDasu={maDasu} vyrizeny />)}
          </ul>
        </details>
      )}
    </div>
  )
}
