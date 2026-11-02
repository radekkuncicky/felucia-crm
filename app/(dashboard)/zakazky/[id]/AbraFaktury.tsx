import { cn } from '@/lib/cn'
import { formatKc } from '@/lib/format'
import { datumPraha } from '@/lib/kpi/obdobi'

export interface AbraFakturaRadek {
  id: string
  kod: string
  typ: string
  typDokl: string
  etapaCislo: number | null
  vystaveno: Date
  splatnost: Date | null
  uhrazeno: Date | null
  celkemSDph: number
  zbyvaUhradit: number
}

const TYP: Record<string, string> = { FAKTURA: 'Faktura', ZALOHA: 'Záloha', DOBROPIS: 'Dobropis' }

function stav(f: AbraFakturaRadek, dnes: Date) {
  if (f.zbyvaUhradit <= 0) return { text: f.uhrazeno ? `uhrazeno ${datumPraha(f.uhrazeno)}` : 'uhrazeno', cls: 'text-green-600 dark:text-green-400' }
  const poSplatnosti = f.splatnost && f.splatnost < dnes
  return {
    text: `${f.zbyvaUhradit < f.celkemSDph ? `zbývá ${formatKc(f.zbyvaUhradit)}` : 'neuhrazeno'}${poSplatnosti ? ' · po splatnosti' : ''}`,
    cls: poSplatnosti ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400',
  }
}

/** Vydané faktury a zálohy zakázky z ABRA Flexi (jen čtení, sync každých 30 min) */
export default function AbraFaktury({ faktury }: { faktury: AbraFakturaRadek[] }) {
  if (!faktury.length) return null
  const dnes = new Date()
  const uhrazeno = faktury.reduce((s, f) => s + f.celkemSDph - f.zbyvaUhradit, 0)
  const celkem = faktury.reduce((s, f) => s + f.celkemSDph, 0)
  return (
    <section aria-labelledby="abra-faktury" className="rounded-xl border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 px-4 py-3 border-b border-line">
        <h2 id="abra-faktury" className="text-xs font-semibold text-muted uppercase">Faktury z ABRA Flexi</h2>
        <p className="text-xs text-muted">uhrazeno {formatKc(uhrazeno)} z {formatKc(celkem)} s DPH</p>
      </div>
      <ul className="divide-y divide-line">
        {faktury.map(f => {
          const s = stav(f, dnes)
          return (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 px-4 py-2.5">
              <span className="min-w-0 text-sm text-fg">
                <span className="font-medium">{TYP[f.typ] ?? f.typDokl}</span> {f.kod}
                {f.etapaCislo !== null && <span className="text-muted"> · etapa {f.etapaCislo}</span>}
                <span className="text-muted"> · {datumPraha(f.vystaveno)}</span>
              </span>
              <span className="flex items-baseline gap-3 text-sm whitespace-nowrap">
                <span className={cn('text-xs', s.cls)}>{s.text}</span>
                <span className="font-semibold text-fg">{formatKc(f.celkemSDph)}</span>
              </span>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
