import { cn } from '@/lib/cn'
import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_POLOZKY, kc, mnozstvi, soucetNabidky } from '../demoData'
import { DocChip, MockFigure, UiFrame } from '../primitives'
import { Callout, FakeButton } from './parts'

/** Nabídka z položek materiálu a práce, součet bez DPH, akce v liště jako v aplikaci. */
export function NabidkaMock({ className }: { className?: string }) {
  return (
    <div className={className}>
      <MockFigure label={`Ukázka nabídky ${DEMO_DOKLADY.nabidka} pro ${DEMO_KLIENT.jmeno}: ${DEMO_POLOZKY.length} položek materiálu a práce, celkem ${kc(soucetNabidky())} bez DPH.`}>
        <UiFrame title={`Nabídka ${DEMO_DOKLADY.nabidka}`} meta={DEMO_DOKLADY.op}>
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--mk-line)] px-4 py-3 sm:px-5">
            <DocChip kind="nabidka">{DEMO_DOKLADY.nabidka}</DocChip>
            <span className="ml-auto flex flex-wrap justify-end gap-1.5">
              <FakeButton className="hidden sm:inline-flex">PDF</FakeButton>
              <FakeButton className="hidden md:inline-flex">Duplikovat</FakeButton>
              <FakeButton className="hidden md:inline-flex">Jinému klientovi</FakeButton>
              <FakeButton variant="primary">Poslat klientovi</FakeButton>
            </span>
          </div>

          <div className="px-4 py-2 sm:px-5">
            <div className="grid grid-cols-[1fr_auto] gap-x-4 border-b border-[var(--mk-line)] py-2 text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--mk-faint)] sm:grid-cols-[1fr_88px_96px_104px]">
              <span>Položka</span>
              <span className="hidden text-right sm:block">Množství</span>
              <span className="hidden text-right sm:block">Cena/jedn.</span>
              <span className="text-right">Celkem</span>
            </div>
            {DEMO_POLOZKY.map(p => (
              <div key={p.id} className="grid grid-cols-[1fr_auto] items-center gap-x-4 border-b border-[var(--mk-line)] py-2 text-[13.5px] last:border-0 sm:grid-cols-[1fr_88px_96px_104px]">
                <span className="flex min-w-0 items-center gap-2">
                  <span className={cn('shrink-0 rounded px-1.5 py-px text-[10.5px] font-semibold', p.typ === 'MATERIAL' ? 'mk-pill-blue' : 'mk-pill-violet')}>
                    {p.typ === 'MATERIAL' ? 'Materiál' : 'Práce'}
                  </span>
                  <span className="truncate sm:hidden">{p.kratce}</span>
                  <span className="hidden truncate sm:inline">{p.nazev}</span>
                </span>
                <span className="mk-doc hidden text-right text-[12.5px] text-[var(--mk-muted)] sm:block">{mnozstvi(p.mnozstvi, p.jednotka)}</span>
                <span className="mk-doc hidden text-right text-[12.5px] text-[var(--mk-muted)] sm:block">{kc(p.cena)}</span>
                <span className="mk-doc text-right text-[12.5px]">{kc(p.mnozstvi * p.cena)}</span>
              </div>
            ))}
          </div>

          <div className="flex items-baseline justify-between gap-3 border-t border-[var(--mk-line-strong)] bg-[var(--mk-bg)] px-4 py-3 sm:px-5">
            <span className="text-[13px] text-[var(--mk-muted)]">Celkem bez DPH</span>
            <span className="mk-doc text-[18px] font-semibold">{kc(soucetNabidky())}</span>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>Položky z katalogu s cenami podle ceníku. Hotovou nabídku zkopírujete do jiného obchodního případu, PDF má vzhled vaší firmy.</Callout>
    </div>
  )
}
