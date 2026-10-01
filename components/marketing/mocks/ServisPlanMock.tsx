import { cn } from '@/lib/cn'
import { DEMO_KLIENT, DEMO_SERVIS_PLAN } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'

/** Servis - Plánované: prohlídky založené z kontraktů (naše klientka zvýrazněná). */
export function ServisPlanMock({ className }: { className?: string }) {
  return (
    <div className={className}>
      <MockFigure label={`Ukázka plánu servisu: ${DEMO_SERVIS_PLAN.map(r => `${r.termin} ${r.klient}, ${r.zarizeni}, ${r.typ}, ${r.stav}`).join('; ')}.`}>
        <UiFrame title="Servis - Plánované" meta="Manažer zakázek">
          <div className="p-4 sm:p-5">
            {DEMO_SERVIS_PLAN.map(r => {
              const nase = r.klient === DEMO_KLIENT.jmeno
              return (
                <div
                  key={r.cislo}
                  className={cn(
                    'grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 border-b border-[var(--mk-line)] py-3 last:border-0 sm:grid-cols-[112px_1fr_auto_auto]',
                    nase && '-mx-2 rounded-md border-0 bg-[var(--mk-green-tint)] px-2',
                  )}
                >
                  <span className="mk-doc text-[12.5px] text-[var(--mk-muted)]">{r.termin}</span>
                  <span className="order-3 min-w-0 sm:order-none">
                    <span className="block truncate text-[13.5px] font-semibold">{r.klient}</span>
                    <span className="block truncate text-[12px] text-[var(--mk-muted)]">{r.zarizeni} - {r.typ}</span>
                  </span>
                  <DocChip kind="servis" size="sm" className="hidden sm:inline-flex">{r.cislo}</DocChip>
                  <StatusPill tone={r.stav === 'Naplánovaná' ? 'blue' : 'neutral'} dot>{r.stav}</StatusPill>
                </div>
              )
            })}
          </div>
        </UiFrame>
      </MockFigure>
    </div>
  )
}
