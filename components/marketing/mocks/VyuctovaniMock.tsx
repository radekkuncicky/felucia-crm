import { cn } from '@/lib/cn'
import { DEMO_DOKLADY, DEMO_LIDE, DEMO_POLOZKY, VYUCTOVANI_STAVY, kc, mnozstvi, soucetVyuctovani } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'
import { Callout, StateTrack } from './parts'

/** Vyúčtování vzniklé z protokolu: množství Použito, schváleno Manažerem zakázek. */
export function VyuctovaniMock({ className }: { className?: string }) {
  return (
    <div className={className}>
      <MockFigure label={`Ukázka vyúčtování ${DEMO_DOKLADY.vyuctovani} vzniklého z protokolu ${DEMO_DOKLADY.protokol}: potrubí vyúčtováno 12 m, celkem ${kc(soucetVyuctovani())} bez DPH, stav Schváleno.`}>
        <UiFrame title={`Vyúčtování ${DEMO_DOKLADY.vyuctovani}`} meta={DEMO_DOKLADY.zakazka}>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <DocChip kind="vyuctovani">{DEMO_DOKLADY.vyuctovani}</DocChip>
              <span className="text-[12px] text-[var(--mk-faint)]">z</span>
              <DocChip kind="protokol" size="sm">{DEMO_DOKLADY.protokol}</DocChip>
              <StatusPill tone="green" dot className="ml-auto">Schváleno</StatusPill>
            </div>

            <StateTrack steps={VYUCTOVANI_STAVY} current={2} />

            <div>
              {DEMO_POLOZKY.map(p => {
                const hi = p.pouzito !== p.mnozstvi
                return (
                  <div key={p.id} className={cn('flex items-center gap-3 border-b border-[var(--mk-line)] py-2 text-[13.5px] last:border-0', p.typ === 'PRACE' && 'hidden sm:flex')}>
                    <span className={cn('min-w-0 flex-1 truncate', hi && 'font-semibold')}>
                      <span className="sm:hidden">{p.kratce}</span>
                      <span className="hidden sm:inline">{p.nazev}</span>
                    </span>
                    <span className={cn('mk-doc w-14 text-right text-[12.5px]', hi ? 'font-bold text-[var(--mk-diff-ink)]' : 'text-[var(--mk-muted)]')}>{mnozstvi(p.pouzito, p.jednotka)}</span>
                    <span className="mk-doc hidden w-24 text-right text-[12.5px] sm:block">{kc(p.pouzito * p.cena)}</span>
                  </div>
                )
              })}
            </div>

            <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-[var(--mk-line-strong)] pt-3">
              <span className="text-[12.5px] text-[var(--mk-muted)]">Schválil {DEMO_LIDE.vedouci.jmeno}, {DEMO_LIDE.vedouci.role}</span>
              <span className="mk-doc text-[17px] font-semibold">{kc(soucetVyuctovani())} <span className="text-[12px] font-normal text-[var(--mk-muted)]">bez DPH</span></span>
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>Vyúčtování nikdo nepřepisuje: převezme skutečné množství z protokolu a ceny ze zakázky. Kancelář ho jen zkontroluje a schválí.</Callout>
    </div>
  )
}
