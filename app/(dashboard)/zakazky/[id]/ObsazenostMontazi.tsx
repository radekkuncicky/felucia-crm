'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { api } from '@/lib/api'
import { cn } from '@/lib/cn'
import { Dialog } from '@/components/ui/Dialog'
import { addDaysStr } from '@/lib/calendarEvents'
import { formatIsoCz } from '@/lib/workingDays'
import type { MontazVRozsahu, TechnikMontaze } from '@/lib/montazeVRozsahu'

/** Kolik dní před a po zvoleném termínu dialog ukazuje */
const OKOLI_DNI = 7

const prekryva = (m: MontazVRozsahu, od: string, doo: string) => m.od <= doo && m.do >= od

function useMontaze(zakazkaId: string, od: string, doo: string) {
  const [data, setData] = useState<MontazVRozsahu[] | null>(null)
  useEffect(() => {
    if (!od) { setData(null); return }
    let zruseno = false
    setData(null)
    api.get<MontazVRozsahu[]>(`/api/zakazky/montaze?od=${od}&do=${doo || od}&bez=${zakazkaId}`, { silent: true })
      .then(res => { if (!zruseno) setData(res.ok && res.data ? res.data : []) })
    return () => { zruseno = true }
  }, [zakazkaId, od, doo])
  return data
}

/**
 * Řádek pod výběrem termínu: kolik montáží v tom termínu už běží a kdo z techniků
 * této zakázky je jinde. Tlačítko otevře dialog s přehledem okolí ±7 dní.
 */
export function ObsazenostSouhrn({ zakazkaId, od, doo, technikIds }: {
  zakazkaId: string
  od: string
  doo: string
  /** technici této zakázky/etapy — zvýrazní se kolize */
  technikIds: string[]
}) {
  const [open, setOpen] = useState(false)
  const montaze = useMontaze(zakazkaId, od, doo)
  if (!od) return null

  const kolize = new Map<string, string>()
  for (const m of montaze ?? []) {
    for (const t of [m.hlavniTechnik, ...m.technici]) {
      if (t && technikIds.includes(t.id)) kolize.set(t.id, t.jmeno)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs w-full">
      <span className="text-muted">
        {montaze === null ? 'Zjišťuji obsazenost…'
          : montaze.length === 0 ? 'V tomto termínu žádná jiná montáž.'
          : `V tomto termínu ${montaze.length} ${montaze.length === 1 ? 'jiná montáž' : montaze.length < 5 ? 'jiné montáže' : 'jiných montáží'}.`}
      </span>
      {kolize.size > 0 && (
        <span className="font-medium text-amber-700 dark:text-amber-400">
          Jinde: {Array.from(kolize.values()).join(', ')}
        </span>
      )}
      <button type="button" data-compact onClick={() => setOpen(true)} className="hit-area font-medium text-primary dark:text-primary-light hover:underline">
        Obsazenost
      </button>
      {open && (
        <ObsazenostDialog zakazkaId={zakazkaId} od={od} doo={doo || od} technikIds={technikIds} onClose={() => setOpen(false)} />
      )}
    </div>
  )
}

function ObsazenostDialog({ zakazkaId, od, doo, technikIds, onClose }: {
  zakazkaId: string
  od: string
  doo: string
  technikIds: string[]
  onClose: () => void
}) {
  const montaze = useMontaze(zakazkaId, addDaysStr(od, -OKOLI_DNI), addDaysStr(doo, OKOLI_DNI))
  const vTerminu = (montaze ?? []).filter(m => prekryva(m, od, doo))
  const okoli = (montaze ?? []).filter(m => !prekryva(m, od, doo))
  const termin = od === doo ? formatIsoCz(od) : `${formatIsoCz(od)} – ${formatIsoCz(doo)}`

  return (
    <Dialog open onClose={onClose} title={`Obsazenost — ${termin}`} size="lg">
      {montaze === null ? (
        <p className="text-sm text-muted py-6 text-center">Načítám montáže…</p>
      ) : (
        <div className="space-y-5">
          <Sekce nadpis="Ve zvoleném termínu" prazdne="Žádná jiná montáž — technici jsou volní." montaze={vTerminu} technikIds={technikIds} />
          <Sekce nadpis={`Okolí ±${OKOLI_DNI} dní`} prazdne="Nic dalšího v okolí." montaze={okoli} technikIds={technikIds} />
          {technikIds.length > 0 && (
            <p className="text-xs text-muted">
              <span className="font-medium text-amber-700 dark:text-amber-400">Zvýraznění</span> technici jsou přiřazení i k této zakázce. ★ = hlavní technik.
            </p>
          )}
        </div>
      )}
    </Dialog>
  )
}

function Sekce({ nadpis, prazdne, montaze, technikIds }: {
  nadpis: string
  prazdne: string
  montaze: MontazVRozsahu[]
  technikIds: string[]
}) {
  return (
    <section>
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">{nadpis} ({montaze.length})</h3>
      {montaze.length === 0 ? (
        <p className="text-sm text-muted">{prazdne}</p>
      ) : (
        <ul className="divide-y divide-line border border-line rounded-xl">
          {montaze.map(m => (
            <li key={m.id} className="px-3 py-2.5 flex flex-col sm:flex-row sm:items-start gap-1 sm:gap-3">
              <span className="text-xs font-medium text-fg whitespace-nowrap sm:w-32 shrink-0 pt-0.5">
                {m.od === m.do ? formatIsoCz(m.od) : `${formatIsoCz(m.od)} – ${formatIsoCz(m.do)}`}
              </span>
              <div className="min-w-0 flex-1">
                <Link href={m.href} className="text-sm font-medium text-fg hover:underline">
                  {[m.klient, m.technologie].filter(Boolean).join(' – ')}
                </Link>
                <span className="text-xs text-muted ml-1.5">{m.cislo}{m.etapa ? ` · ${m.etapa}` : ''}{m.kdykoliv ? ' · kdykoliv' : ''}</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {m.hlavniTechnik && <TechnikStitek t={m.hlavniTechnik} hlavni kolize={technikIds.includes(m.hlavniTechnik.id)} />}
                  {m.technici.map(t => <TechnikStitek key={t.id} t={t} kolize={technikIds.includes(t.id)} />)}
                  {!m.hlavniTechnik && <span className="text-xs text-muted italic">bez techniků</span>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function TechnikStitek({ t, hlavni = false, kolize }: { t: TechnikMontaze; hlavni?: boolean; kolize: boolean }) {
  return (
    <span className={cn(
      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs',
      kolize
        ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 font-medium'
        : 'bg-surface-2 text-fg',
      hlavni && 'font-semibold',
    )}>
      {hlavni && <span aria-label="hlavní technik">★</span>}
      {t.jmeno}
    </span>
  )
}
