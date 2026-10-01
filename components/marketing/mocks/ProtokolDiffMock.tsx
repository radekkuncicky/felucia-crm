import { cn } from '@/lib/cn'
import { DEMO_DOKLADY, DEMO_POLOZKY, PROTOKOL_STAVY, VYUCTOVANI_STAVY, mnozstvi } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'
import { Callout, FlowArrow, StateTrack } from './parts'

// Doprava a elektro se do ukázky nevejdou - stačí 5 řádků, potrubí je pointa.
const RADKY = DEMO_POLOZKY.filter(p => ['tc', 'zas', 'pot', 'kon', 'mon'].includes(p.id))

/**
 * Předávací protokol: Plánováno (z nabídky) vs. Použito. Sloupec Rozdíl je
 * zvýraznění ukázky - aplikace ho jako sloupec nemá (facts bod 8).
 */
export function ProtokolDiffMock({ className }: { className?: string }) {
  const potrubi = RADKY.find(p => p.id === 'pot')!
  return (
    <div className={className}>
      <MockFigure label={`Ukázka předávacího protokolu ${DEMO_DOKLADY.protokol}: v nabídce ${mnozstvi(potrubi.mnozstvi, potrubi.jednotka)} potrubí, použito ${mnozstvi(potrubi.pouzito, potrubi.jednotka)}, rozdíl plus ${potrubi.pouzito - potrubi.mnozstvi} m. Protokol schválen, z něj vzniklo vyúčtování ${DEMO_DOKLADY.vyuctovani}.`}>
        <UiFrame title={`Předávací protokol ${DEMO_DOKLADY.protokol}`} meta={DEMO_DOKLADY.zakazka}>
          <div className="p-4 sm:p-5">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <DocChip kind="protokol">{DEMO_DOKLADY.protokol}</DocChip>
              <StatusPill tone="green" dot className="ml-auto">Schválen</StatusPill>
            </div>

            <div className="grid grid-cols-[1fr_52px_60px] gap-x-2 border-b border-[var(--mk-line)] pb-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--mk-faint)] sm:grid-cols-[1fr_168px_84px_84px] sm:gap-x-4">
              <span>Položka</span>
              <span className="text-right"><span className="sm:hidden">Plán</span><span className="hidden sm:inline">Plánováno (z nabídky)</span></span>
              <span className="text-right">Použito</span>
              <span className="hidden text-right sm:block">Rozdíl</span>
            </div>

            {RADKY.map(p => {
              const rozdil = p.pouzito - p.mnozstvi
              const hi = rozdil !== 0
              return (
                <div
                  key={p.id}
                  className={cn(
                    'grid grid-cols-[1fr_52px_60px] items-center gap-x-2 border-b border-[var(--mk-line)] py-2.5 text-[13.5px] last:border-0 sm:grid-cols-[1fr_168px_84px_84px] sm:gap-x-4',
                    hi && '-mx-2 rounded-md border-0 bg-[var(--mk-diff-tint)] px-2 outline outline-1 outline-[var(--mk-diff-line)]',
                  )}
                >
                  <span className={cn('min-w-0 truncate', hi && 'font-semibold')}>
                    <span className="sm:hidden">{p.kratce}</span>
                    <span className="hidden sm:inline">{p.nazev}</span>
                  </span>
                  <span className="mk-doc text-right text-[12.5px] text-[var(--mk-muted)]">{mnozstvi(p.mnozstvi, p.jednotka)}</span>
                  <span className={cn('mk-doc text-right text-[12.5px]', hi && 'font-bold text-[var(--mk-diff-ink)]')}>{mnozstvi(p.pouzito, p.jednotka)}</span>
                  <span className={cn('mk-doc hidden text-right text-[12.5px] sm:block', hi ? 'font-bold text-[var(--mk-diff-ink)]' : 'text-[var(--mk-faint)]')}>
                    {hi ? `+${mnozstvi(rozdil, p.jednotka)}` : '0'}
                  </span>
                </div>
              )
            })}

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--mk-line)] pt-3">
              <StateTrack steps={PROTOKOL_STAVY} current={2} />
              <FlowArrow />
              <DocChip kind="vyuctovani" size="sm">{DEMO_DOKLADY.vyuctovani}</DocChip>
              <span className="hidden sm:inline-flex">
                <StateTrack steps={VYUCTOVANI_STAVY} current={0} compact="never" />
              </span>
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>Technik zapíše skutečně použité množství na místě. Manažer zakázek protokol schválí a vyúčtování vznikne s množstvím Použito.</Callout>
    </div>
  )
}
