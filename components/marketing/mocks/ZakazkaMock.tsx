import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_LIDE, DEMO_MATERIAL, DEMO_TECHNOLOGIE, DEMO_TERMIN, ZAKAZKA_STAVY } from '../demoData'
import { DocChip, MockFigure, UiFrame } from '../primitives'
import { IconCalendar, IconNavigate, IconUser } from '../icons'
import { Callout, Field, StateTrack } from './parts'

/** Detail zakázky v kanceláři: stavový pruh, termín, technik, vedoucí, místo stavby, materiál. */
export function ZakazkaMock({ className, callout = true }: { className?: string; callout?: boolean }) {
  const vydano = DEMO_MATERIAL.filter(p => p.stav === 'Vydáno').length
  return (
    <div className={className}>
      <MockFigure label={`Ukázka zakázky ${DEMO_DOKLADY.zakazka}: ${DEMO_KLIENT.jmeno}, ${DEMO_TECHNOLOGIE}, stav Přiřazena, montáž ${DEMO_TERMIN.montaz}, technik ${DEMO_LIDE.technik.jmeno}, vedoucí ${DEMO_LIDE.vedouci.jmeno}, místo stavby ${DEMO_KLIENT.mesto}.`}>
        <UiFrame title={`Zakázka ${DEMO_DOKLADY.zakazka}`} meta={DEMO_LIDE.vedouci.role}>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <DocChip kind="zakazka" prefix="zakázka">{DEMO_DOKLADY.zakazka}</DocChip>
              <span className="min-w-0 truncate text-[15px] font-semibold">{DEMO_KLIENT.jmeno} - {DEMO_TECHNOLOGIE}</span>
              <DocChip kind="op" size="sm" className="hidden sm:inline-flex">{DEMO_DOKLADY.op}</DocChip>
            </div>

            <StateTrack steps={ZAKAZKA_STAVY} current={ZAKAZKA_STAVY.indexOf('Přiřazena')} />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field label="Termín montáže">
                <span className="inline-flex items-center gap-1.5"><IconCalendar className="h-4 w-4 text-[var(--mk-green-ink)]" />{DEMO_TERMIN.montaz}</span>
              </Field>
              <Field label="Technik">
                <span className="inline-flex items-center gap-1.5"><IconUser className="h-4 w-4 text-[var(--mk-green-ink)]" />{DEMO_LIDE.technik.jmeno}</span>
              </Field>
              <Field label="Vedoucí" className="hidden sm:block">{DEMO_LIDE.vedouci.jmeno}</Field>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--mk-line)] bg-[var(--mk-bg)] p-3">
              <Field label="Místo stavby">{DEMO_KLIENT.mesto}, {DEMO_KLIENT.objekt.toLowerCase()}</Field>
              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--mk-green-ink)]">
                <IconNavigate className="h-4 w-4" /> Navigovat
              </span>
            </div>

            <div className="hidden items-center gap-3 sm:flex">
              <span className="text-[12px] font-medium uppercase tracking-[0.05em] text-[var(--mk-faint)]">Materiál</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--mk-line)]">
                <span className="block h-full rounded-full bg-[var(--mk-green)]" style={{ width: `${(vydano / DEMO_MATERIAL.length) * 100}%` }} />
              </span>
              <span className="mk-doc text-[12px] text-[var(--mk-muted)]">Vydáno {vydano}/{DEMO_MATERIAL.length}</span>
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      {callout && <Callout>Zakázka vznikne sama po podpisu smlouvy a převezme klienta i položky nabídky. Kancelář doplní termín, technika a vedoucího.</Callout>}
    </div>
  )
}
