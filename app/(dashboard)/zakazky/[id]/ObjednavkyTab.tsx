'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDate, formatKcPresne } from '@/lib/format'
import ObjednatModal from '@/components/objednavky/ObjednatModal'
import type { ObjednavkaDto } from '@/components/objednavky/ObjednavkaDetail'
import { OBJ_STAV_LABELS, OBJ_STAV_COLORS } from '@/app/(dashboard)/sklad/objednavkyStav'

/** Záložka Objednávky na zakázce — seznam objednávek materiálu u dodavatelů. */

interface Props {
  zakazkaId: string
  /** sklad PLNY */
  canEdit: boolean
  showNakupky: boolean
}

export default function ObjednavkyTab({ zakazkaId, canEdit, showNakupky }: Props) {
  const [rows, setRows] = useState<ObjednavkaDto[] | null>(null)
  const [showObjednat, setShowObjednat] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/zakazky/${zakazkaId}/objednavky`)
    if (res.ok) setRows(await res.json())
  }, [zakazkaId])

  useEffect(() => { load() }, [load])

  return (
    <>
      {showObjednat && <ObjednatModal zakazkaId={zakazkaId} showNakupky={showNakupky} onClose={() => setShowObjednat(false)} onCreated={load} />}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
          <h3 className="font-semibold text-gray-900 dark:text-white">Objednávky u dodavatelů{rows ? ` (${rows.length})` : ''}</h3>
          {canEdit && (
            <button onClick={() => setShowObjednat(true)} className="text-sm font-medium text-primary dark:text-primary-light hover:underline flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              Objednat u dodavatele
            </button>
          )}
        </div>

        {rows === null ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">Načítám…</div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
            Zatím žádná objednávka.{canEdit && ' Vyberte položky zakázky a objednejte je u dodavatele.'}
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {rows.map(o => (
              <Link key={o.id} href={`/zakazky/${zakazkaId}/objednavky/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 hover:bg-gray-50 dark:hover:bg-slate-700/30">
                <span className="font-mono text-sm font-semibold text-gray-900 dark:text-white">{o.cislo}</span>
                <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${OBJ_STAV_COLORS[o.stav]}`}>{OBJ_STAV_LABELS[o.stav]}</span>
                <span className="text-sm text-gray-700 dark:text-slate-300 flex-1 min-w-[140px]">{o.dodavatel.nazev}</span>
                <span className="text-xs text-gray-500 dark:text-slate-400">{o.pocetDorucenych}/{o.pocetPolozek} pol. doručeno</span>
                {o.pozadovanyTermin && <span className="text-xs text-gray-500 dark:text-slate-400">termín {formatDate(o.pozadovanyTermin)}</span>}
                {showNakupky && o.celkem !== null && <span className="text-sm font-medium text-gray-900 dark:text-white whitespace-nowrap">{formatKcPresne(o.celkem)}</span>}
                <span className="text-xs text-gray-400">{formatDate(o.vytvoreno)}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
