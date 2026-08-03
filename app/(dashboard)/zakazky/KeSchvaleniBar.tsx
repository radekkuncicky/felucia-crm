import Link from 'next/link'
import { formatDate } from '@/lib/format'

export interface KeSchvaleniPolozka {
  id: string
  cislo: string
  zakazkaId: string
  zakazkaCislo: string
  popis: string
  datum: string | null
  href: string
  typ: 'PREDAVAK' | 'VYUCTOVANI'
}

/**
 * Fronta dokladů čekajících na manažera napříč všemi zakázkami — bez ní se na
 * podepsaný protokol dá přijít jen tak, že člověk otevře konkrétní zakázku.
 */
export default function KeSchvaleniBar({ polozky }: { polozky: KeSchvaleniPolozka[] }) {
  if (polozky.length === 0) return null

  return (
    <div className="bg-amber-50 dark:bg-amber-900/15 border border-amber-200 dark:border-amber-800/60 rounded-xl overflow-hidden">
      <div className="px-4 py-2.5 flex items-center gap-2 border-b border-amber-200/70 dark:border-amber-800/40">
        <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
          Čeká na schválení ({polozky.length})
        </h2>
      </div>
      <div className="divide-y divide-amber-200/60 dark:divide-amber-800/30">
        {polozky.map(p => (
          <Link
            key={`${p.typ}-${p.id}`}
            href={p.href}
            className="flex items-center justify-between gap-3 px-4 py-2.5 hover:bg-amber-100/60 dark:hover:bg-amber-900/25 transition-colors"
          >
            <div className="min-w-0 flex items-center gap-3 flex-wrap">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                p.typ === 'PREDAVAK'
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
                  : 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
              }`}>
                {p.typ === 'PREDAVAK' ? 'Protokol' : 'Vyúčtování'}
              </span>
              <span className="font-mono font-bold text-sm text-gray-900 dark:text-white">{p.cislo}</span>
              <span className="text-xs text-gray-600 dark:text-slate-400 truncate">
                {p.zakazkaCislo} · {p.popis}
                {p.datum && ` · ${formatDate(p.datum)}`}
              </span>
            </div>
            <svg className="w-4 h-4 text-amber-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ))}
      </div>
    </div>
  )
}
