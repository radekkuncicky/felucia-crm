import Link from 'next/link'
import { cn } from '@/lib/cn'
import { formatCil, formatKpi, mesicLabel, type KpiVysledek, type Semafor } from '@/lib/kpi'

export const SEMAFOR_LABEL: Record<Semafor, string> = {
  ZELENA: 'Cíl splněn',
  ORANZOVA: 'Těsně pod cílem',
  CERVENA: 'Mimo cíl',
  BEZ_CILE: 'Bez cíle',
  BEZ_DAT: 'Chybí data',
}

const TECKA: Record<Semafor, string> = {
  ZELENA: 'bg-green-500',
  ORANZOVA: 'bg-amber-500',
  CERVENA: 'bg-red-500',
  BEZ_CILE: 'bg-slate-400',
  BEZ_DAT: 'bg-slate-300 dark:bg-slate-600',
}

const RAMECEK: Record<Semafor, string> = {
  ZELENA: 'border-green-300 dark:border-green-800',
  ORANZOVA: 'border-amber-300 dark:border-amber-800',
  CERVENA: 'border-red-300 dark:border-red-800',
  BEZ_CILE: 'border-line',
  BEZ_DAT: 'border-line border-dashed',
}

export function SemaforTecka({ s, className }: { s: Semafor; className?: string }) {
  return <span aria-hidden className={cn('inline-block w-2.5 h-2.5 rounded-full shrink-0', TECKA[s], className)} />
}

/** Mini trend (posledních 6 měsíců) — sloupce relativně k maximu */
function MiniTrend({ k }: { k: KpiVysledek }) {
  const body = k.trend.slice(-6)
  const max = Math.max(...body.map(b => Math.abs(b.hodnota ?? 0)), 0)
  if (!body.length || max === 0) return null
  return (
    <div className="flex items-end gap-0.5 h-6" aria-hidden>
      {body.map(b => (
        <span
          key={b.klic}
          className={cn('w-1.5 rounded-sm', b.klic === k.mesic ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600')}
          style={{ height: `${Math.max(8, (Math.abs(b.hodnota ?? 0) / max) * 100)}%` }}
        />
      ))}
    </div>
  )
}

/** Dlaždice KPI — hodnota za poslední uzavřený měsíc, cíl, semafor; proklik na detail */
export function KpiDlazdice({ k, className }: { k: KpiVysledek; className?: string }) {
  const bezDat = k.semafor === 'BEZ_DAT'
  return (
    <Link
      href={`/kpi/${k.def.kod}`}
      className={cn(
        'block rounded-xl border bg-surface p-3.5 hover:bg-surface-2 transition-colors min-h-[44px]',
        RAMECEK[k.semafor], className,
      )}
    >
      <div className="flex items-center gap-2">
        <SemaforTecka s={k.semafor} />
        <p className="text-xs font-medium text-muted truncate">{k.def.nazev}</p>
      </div>
      <div className="mt-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <p className={cn('text-xl font-bold leading-tight', bezDat ? 'text-muted' : 'text-fg')}>
            {bezDat ? 'chybí data' : formatKpi(k.hodnota, k.jednotka)}
          </p>
          <p className="text-[11px] text-muted mt-0.5 truncate">
            {bezDat ? `fáze ${k.def.faze}` : `${mesicLabel(k.mesic)} · ${formatCil(k.def, k.nastaveni.cil)}`}
          </p>
        </div>
        {!bezDat && <MiniTrend k={k} />}
      </div>
    </Link>
  )
}
