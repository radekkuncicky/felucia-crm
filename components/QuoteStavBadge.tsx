import type { QuoteStav } from '@prisma/client'
import { cn } from '@/lib/cn'
import { QUOTE_STAV_LABEL } from '@/lib/quoteStav'

const STYL: Record<QuoteStav, string> = {
  ROZPRACOVANA: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-300',
  ODESLANA: 'bg-sky-500/10 text-sky-800 dark:text-sky-300 border border-sky-500/30',
  AKCEPTOVANA: 'bg-green-500/10 text-green-800 dark:text-green-300 border border-green-500/30',
  ODMITNUTA: 'bg-red-500/10 text-red-700 dark:text-red-300 border border-red-500/30',
}

/** Stav nabídky vůči klientovi; u odeslané volitelně „před N dny“ */
export default function QuoteStavBadge({ stav, odeslanoAt, className }: { stav: QuoteStav; odeslanoAt?: string | Date | null; className?: string }) {
  const dni = stav === 'ODESLANA' && odeslanoAt
    ? Math.floor((Date.now() - new Date(odeslanoAt).getTime()) / (24 * 3600_000))
    : null
  return (
    <span className={cn('inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap', STYL[stav], className)}>
      {QUOTE_STAV_LABEL[stav]}
      {dni !== null && <span className="opacity-75 ml-1">· {dni === 0 ? 'dnes' : `před ${dni} d`}</span>}
    </span>
  )
}
