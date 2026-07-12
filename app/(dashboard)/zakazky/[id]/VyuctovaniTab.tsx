'use client'

import { VyuctovaniStav } from '@prisma/client'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

const STAV_LABELS: Record<VyuctovaniStav, string> = {
  NAVRH: 'Návrh',
  KE_SCHVALENI: 'Ke schválení',
  SCHVALENO: 'Schváleno',
}

const STAV_COLORS: Record<VyuctovaniStav, string> = {
  NAVRH: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  KE_SCHVALENI: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  SCHVALENO: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
}

interface Vyuctovani {
  id: string
  cislo: string
  stav: VyuctovaniStav
  vytvoreno: string
  etapaId: string | null
}

interface EtapaInfo {
  id: string
  cislo: number
  nazev: string | null
}

interface Props {
  zakazkaId: string
  vyuctovani: Vyuctovani[]
  canCreate: boolean
  etapy?: EtapaInfo[]
}

function VyuRow({ v, zakazkaId }: { v: Vyuctovani; zakazkaId: string }) {
  return (
    <div className="px-5 py-4 flex items-center justify-between gap-4">
      <div>
        <p className="font-mono font-bold text-sm text-gray-900 dark:text-white">{v.cislo}</p>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          {formatDate(v.vytvoreno)}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[v.stav]}`}>
          {STAV_LABELS[v.stav]}
        </span>
        <Link href={`/zakazky/${zakazkaId}/vyuctovani/${v.id}`} className="text-sm text-primary dark:text-primary-light hover:underline font-medium">
          Detail
        </Link>
      </div>
    </div>
  )
}

export default function VyuctovaniTab({ zakazkaId, vyuctovani, canCreate, etapy = [] }: Props) {
  const hasEtapy = etapy.length > 0

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900 dark:text-white">Vyúčtování ({vyuctovani.length})</h3>
        {canCreate && !hasEtapy && (
          <Link
            href={`/zakazky/${zakazkaId}/vyuctovani/nove`}
            className="text-sm font-medium text-primary dark:text-primary-light hover:underline"
          >
            + Generovat vyúčtování
          </Link>
        )}
      </div>

      {vyuctovani.length === 0 && !hasEtapy ? (
        <div className="text-center py-10 text-gray-400 dark:text-slate-500 text-sm">
          {canCreate ? 'Zatím žádné vyúčtování. Klikněte na "Generovat vyúčtování".' : 'Zatím žádné vyúčtování.'}
        </div>
      ) : !hasEtapy ? (
        <div className="divide-y divide-gray-100 dark:divide-slate-700">
          {vyuctovani.map(v => <VyuRow key={v.id} v={v} zakazkaId={zakazkaId} />)}
        </div>
      ) : (
        <div>
          {etapy.map(etapa => {
            const vyu = vyuctovani.filter(v => v.etapaId === etapa.id)
            const label = etapa.nazev ? `Etapa ${etapa.cislo} — ${etapa.nazev}` : `Etapa ${etapa.cislo}`
            return (
              <div key={etapa.id}>
                <div className="px-5 py-2 flex items-center justify-between bg-gray-50 dark:bg-slate-700/40">
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
                  {canCreate && (
                    <Link
                      href={`/zakazky/${zakazkaId}/vyuctovani/nove?etapaId=${etapa.id}`}
                      className="text-xs font-medium text-primary dark:text-primary-light hover:underline"
                    >
                      + Generovat
                    </Link>
                  )}
                </div>
                {vyu.length === 0 ? (
                  <div className="px-5 py-3 text-xs text-gray-400 dark:text-slate-500 italic">Žádné vyúčtování</div>
                ) : (
                  <div className="divide-y divide-gray-100 dark:divide-slate-700">
                    {vyu.map(v => <VyuRow key={v.id} v={v} zakazkaId={zakazkaId} />)}
                  </div>
                )}
              </div>
            )
          })}
          {vyuctovani.filter(v => !v.etapaId).length > 0 && (
            <div>
              <div className="px-5 py-2 bg-gray-50 dark:bg-slate-700/40">
                <span className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase tracking-wide">Bez etapy</span>
              </div>
              <div className="divide-y divide-gray-100 dark:divide-slate-700">
                {vyuctovani.filter(v => !v.etapaId).map(v => <VyuRow key={v.id} v={v} zakazkaId={zakazkaId} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
