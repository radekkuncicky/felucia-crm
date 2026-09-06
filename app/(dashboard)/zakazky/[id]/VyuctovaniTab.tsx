'use client'

import { VyuctovaniStav } from '@prisma/client'
import Link from 'next/link'
import { formatDate, formatKc } from '@/lib/format'

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
  predavakCislo?: string | null
  celkemBezDph: number
  celkemSDph: number
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
    <Link
      href={`/zakazky/${zakazkaId}/vyuctovani/${v.id}`}
      className="px-5 py-4 flex items-center justify-between gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{v.cislo}</span>
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[v.stav]}`}>
            {STAV_LABELS[v.stav]}
          </span>
        </div>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">
          {formatDate(v.vytvoreno)}
          {v.predavakCislo && ` · z protokolu ${v.predavakCislo}`}
        </p>
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            {formatKc(v.celkemSDph)} <span className="text-xs font-normal text-gray-400 dark:text-slate-500">s DPH</span>
          </p>
          <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{formatKc(v.celkemBezDph)} bez DPH</p>
        </div>
        <svg className="w-4 h-4 text-gray-300 dark:text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  )
}

export default function VyuctovaniTab({ zakazkaId, vyuctovani, canCreate, etapy = [] }: Props) {
  const hasEtapy = etapy.length > 0
  const celkemVse = vyuctovani.reduce((s, v) => s + v.celkemSDph, 0)

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
      <div className="px-5 py-4 border-b border-gray-200 dark:border-slate-700 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-baseline gap-3 flex-wrap">
          <h3 className="font-semibold text-gray-900 dark:text-white">Vyúčtování ({vyuctovani.length})</h3>
          {celkemVse > 0 && (
            <span className="text-sm text-gray-500 dark:text-slate-400">
              celkem <strong className="text-gray-900 dark:text-white">{formatKc(celkemVse)}</strong> s DPH
            </span>
          )}
        </div>
        {canCreate && !hasEtapy && (
          <Link
            href={`/zakazky/${zakazkaId}/vyuctovani/nove`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-white bg-[#1B5E20] hover:bg-green-800 px-3 py-2 rounded-lg transition-colors min-h-[40px]"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span className="hidden sm:inline">Generovat vyúčtování</span>
            <span className="sm:hidden">Generovat</span>
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
            const etapaCelkem = vyu.reduce((s, v) => s + v.celkemSDph, 0)
            return (
              <div key={etapa.id}>
                <div className="px-5 py-2 flex items-center justify-between gap-3 bg-gray-50 dark:bg-slate-700/40">
                  <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{label}</span>
                  <div className="flex items-center gap-3">
                    {etapaCelkem > 0 && (
                      <span className="text-xs font-semibold text-gray-600 dark:text-slate-300">{formatKc(etapaCelkem)} s DPH</span>
                    )}
                    {canCreate && (
                      <Link
                        href={`/zakazky/${zakazkaId}/vyuctovani/nove?etapaId=${etapa.id}`}
                        className="text-xs font-medium text-primary dark:text-primary-light hover:underline"
                      >
                        + Generovat
                      </Link>
                    )}
                  </div>
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
