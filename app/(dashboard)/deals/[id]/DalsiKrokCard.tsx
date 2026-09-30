import Link from 'next/link'
import { urcitDalsiKrok, type DalsiKrokVstup } from '@/lib/dalsiKrok'

export function DalsiKrokCard(props: DalsiKrokVstup) {
  const krok = urcitDalsiKrok(props)
  if (!krok) return null
  return (
    <div className="bg-primary-pale dark:bg-green-950/30 rounded-xl border border-primary-light/60 dark:border-green-900/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-primary-dark dark:text-primary-light uppercase">Další krok</p>
        <p className="font-semibold text-gray-900 dark:text-white mt-0.5">{krok.titulek}</p>
        <p className="text-sm text-gray-600 dark:text-slate-400">{krok.popis}</p>
      </div>
      {krok.akce.map(a => (
        <Link
          key={a.href}
          href={a.href}
          className="shrink-0 text-center bg-primary hover:bg-primary-hover text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {a.label}
        </Link>
      ))}
    </div>
  )
}
