import { formatDate, formatKc } from '@/lib/format'
import type { VykazZakazkyTechnik } from '@/lib/vykazPrace'

const h = (n: number) => `${String(Math.round(n * 100) / 100).replace('.', ',')} h`

/** Manažerský přehled výkazů techniků na zakázce / servisu — po technicích, rozbalitelné záznamy. */
export default function VykazPraceTabulka({ technici, showCastky, coZakazka = 'k zakázce' }: { technici: VykazZakazkyTechnik[]; showCastky: boolean; coZakazka?: string }) {
  if (technici.length === 0) {
    return (
      <div className="bg-surface rounded-xl border border-line px-4 py-3">
        <h3 className="text-sm font-semibold text-fg">Práce techniků</h3>
        <p className="text-sm text-muted mt-1">Technici zatím {coZakazka} nezapsali hodiny, km ani položky (zapisují v appce Felucia Technik).</p>
      </div>
    )
  }

  return (
    <div className="bg-surface rounded-xl border border-line overflow-hidden">
      <div className="px-4 py-3 border-b border-line">
        <h3 className="text-sm font-semibold text-fg">Práce techniků</h3>
        <p className="text-xs text-muted">Zapsáno technikem v appce · sazby technika (náklad) · bez DPH</p>
      </div>
      <div className="divide-y divide-line">
        {technici.map(t => (
          <details key={t.userId} className="group">
            <summary className="flex flex-wrap items-center gap-x-6 gap-y-1 px-4 py-3 cursor-pointer list-none hover:bg-surface-2">
              <span className="font-medium text-fg min-w-[10rem] flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-muted transition-transform group-open:rotate-90" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                  <path fillRule="evenodd" d="M7.2 14.8a.75.75 0 0 1 0-1.06L10.94 10 7.2 6.26a.75.75 0 1 1 1.06-1.06l4.27 4.27a.75.75 0 0 1 0 1.06L8.26 14.8a.75.75 0 0 1-1.06 0Z" clipRule="evenodd" />
                </svg>
                {t.jmeno}
              </span>
              <span className="text-sm text-fg">{h(t.soucty.hodiny)}</span>
              <span className="text-sm text-fg">{t.soucty.km} km</span>
              {t.soucty.castkaPolozky > 0 && showCastky && (
                <span className="text-sm text-muted">položky {formatKc(t.soucty.castkaPolozky)}</span>
              )}
              {showCastky && <span className="text-sm font-semibold text-fg ml-auto">{formatKc(t.soucty.castka)}</span>}
              <span className="text-xs text-muted w-full sm:w-auto">
                {t.vyfakturovano === t.soucty.castka && t.soucty.castka > 0
                  ? 'vše vyfakturováno'
                  : showCastky && t.vyfakturovano > 0
                    ? `vyfakturováno ${formatKc(t.vyfakturovano)}`
                    : t.pocetVyfakturovano > 0 ? `${t.pocetVyfakturovano} z ${t.soucty.pocet} vyfakturováno` : 'nevyfakturováno'}
              </span>
            </summary>
            <div className="overflow-x-auto px-4 pb-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted uppercase">
                    <th className="py-1.5 pr-3 font-semibold">Datum</th>
                    <th className="py-1.5 pr-3 font-semibold">Co</th>
                    <th className="py-1.5 pr-3 font-semibold text-right">Hodiny</th>
                    <th className="py-1.5 pr-3 font-semibold text-right">Km</th>
                    {showCastky && <th className="py-1.5 pr-3 font-semibold text-right">Částka</th>}
                    <th className="py-1.5 font-semibold">Stav</th>
                  </tr>
                </thead>
                <tbody>
                  {t.zaznamy.map(z => (
                    <tr key={z.id} className="border-t border-line align-top">
                      <td className="py-1.5 pr-3 whitespace-nowrap text-fg">{formatDate(z.datum)}</td>
                      <td className="py-1.5 pr-3 text-fg">
                        {z.typ === 'POLOZKA' ? z.popis : 'Výjezd'}
                        {z.poznamka && <span className="block text-xs text-muted">{z.poznamka}</span>}
                      </td>
                      <td className="py-1.5 pr-3 text-right text-fg">{z.typ === 'VYJEZD' ? h(z.hodiny) : '—'}</td>
                      <td className="py-1.5 pr-3 text-right text-fg">{z.typ === 'VYJEZD' ? z.km : '—'}</td>
                      {showCastky && <td className="py-1.5 pr-3 text-right whitespace-nowrap text-fg">{z.chybiSazba ? <span className="text-amber-700 dark:text-amber-400">čeká na sazbu</span> : formatKc(z.castka)}</td>}
                      <td className="py-1.5 text-xs text-muted whitespace-nowrap">{z.vyfakturovano ? 'vyfakturováno' : 'otevřené'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
