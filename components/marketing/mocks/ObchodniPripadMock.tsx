import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_LIDE, DEMO_TECHNOLOGIE, OP_STAVY } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'
import { IconCheck } from '../icons'
import { Callout, FakeButton, Field, StateTrack } from './parts'

/** Obchodní případ vzniklý z poptávky: údaje klienta převzaté, hlídání duplicit. */
export function ObchodniPripadMock({ className, callout = true }: { className?: string; callout?: boolean }) {
  const stav = OP_STAVY.indexOf('Nabídka')
  return (
    <div className={className}>
      <MockFigure label={`Ukázka obchodního případu ${DEMO_DOKLADY.op}: klientka ${DEMO_KLIENT.jmeno} převzatá z poptávky z webu, technologie ${DEMO_TECHNOLOGIE}, stav Nabídka.`}>
        <UiFrame title={`Obchodní případ ${DEMO_DOKLADY.op}`} meta={DEMO_LIDE.obchodnik.role}>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <DocChip kind="poptavka" size="sm">{DEMO_DOKLADY.poptavka}</DocChip>
              <span className="text-[12px] text-[var(--mk-faint)]">převedeno na</span>
              <DocChip kind="op" state="current">{DEMO_DOKLADY.op}</DocChip>
              <StatusPill tone="amber" dot className="ml-auto">Nabídka</StatusPill>
            </div>

            <StateTrack steps={OP_STAVY} current={stav} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[var(--mk-green-line)] bg-[var(--mk-green-tint)] p-3">
                <Field label="Klient">{DEMO_KLIENT.jmeno}</Field>
                <p className="mt-1 flex items-center gap-1 text-[12px] font-medium text-[var(--mk-green-ink)]">
                  <IconCheck className="h-3.5 w-3.5" /> Převzato z poptávky
                </p>
              </div>
              <Field label="Technologie" className="p-3">{DEMO_TECHNOLOGIE}</Field>
              <Field label="Adresa díla" className="hidden px-3 sm:block">{DEMO_KLIENT.mesto}</Field>
              <Field label="Obchodník" className="hidden px-3 sm:block">{DEMO_LIDE.obchodnik.jmeno}</Field>
            </div>

            <div className="flex flex-wrap gap-2 border-t border-[var(--mk-line)] pt-3">
              <FakeButton variant="primary">Nová nabídka</FakeButton>
              <FakeButton className="hidden sm:inline-flex">Duplikovat</FakeButton>
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      {callout && <Callout>Lead se převede jedním kliknutím. Při zakládání klienta Felucia hlídá duplicity podle telefonu, e-mailu a jména.</Callout>}
    </div>
  )
}
