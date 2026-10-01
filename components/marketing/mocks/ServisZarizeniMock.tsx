import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_SERVIS, DEMO_ZARIZENI, SERVIS_STAVY } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'
import { Callout, Field, StateTrack } from './parts'

/** Karta zařízení po montáži + šest fází servisní zakázky (lib/servisStav.ts). */
export function ServisZarizeniMock({ className }: { className?: string }) {
  const s = DEMO_SERVIS
  return (
    <div className={className}>
      <MockFigure label={`Ukázka zařízení ${DEMO_ZARIZENI} u klientky ${DEMO_KLIENT.jmeno}: výrobní číslo ${s.vyrobniCislo}, instalace ${s.datumInstalace}, záruka do ${s.zarukaDo}, kontrakt ${s.kontrakt.cislo} ${s.kontrakt.typ}, další prohlídka ${s.dalsi.termin} jako servisní zakázka ${s.dalsi.cislo} ve stavu ${s.dalsi.stav}.`}>
        <UiFrame title="Zařízení" meta={DEMO_KLIENT.jmeno}>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-0 truncate text-[15px] font-semibold">{DEMO_ZARIZENI}</span>
              <span className="ml-auto flex gap-1.5">
                <DocChip kind="zakazka" size="sm" prefix="zakázka">{DEMO_DOKLADY.zakazka}</DocChip>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Typ">{s.typ}</Field>
              <Field label="Výrobní číslo"><span className="mk-doc text-[13px]">{s.vyrobniCislo}</span></Field>
              <Field label="Datum instalace" className="hidden sm:block">{s.datumInstalace}</Field>
              <Field label="Záruka do">
                <span className="inline-flex items-center gap-1.5">{s.zarukaDo} <StatusPill tone="green" className="hidden sm:inline-flex">v záruce</StatusPill></span>
              </Field>
              <Field label="Kontrakt">
                <span className="inline-flex items-center gap-1.5"><DocChip kind="kontrakt" size="sm">{s.kontrakt.cislo}</DocChip><span className="hidden sm:inline">{s.kontrakt.typ}</span></span>
              </Field>
              <Field label="Poslední prohlídka" className="hidden sm:block">{s.posledni.datum}</Field>
            </div>

            <div className="rounded-lg border border-[var(--mk-green-line)] bg-[var(--mk-green-tint)] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--mk-green-ink)]">Další prohlídka</span>
                <span className="text-[14px] font-semibold">{s.dalsi.termin}</span>
                <span className="hidden text-[13px] text-[var(--mk-muted)] sm:inline">{s.dalsi.typ}</span>
                <DocChip kind="servis" size="sm" className="ml-auto">{s.dalsi.cislo}</DocChip>
              </div>
              <StateTrack steps={SERVIS_STAVY} current={SERVIS_STAVY.indexOf(s.dalsi.stav)} className="mt-3" />
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>Po dokončení prohlídky z kontraktu Felucia sama založí další podle intervalu. Servisní modul je v plánech Professional a Enterprise.</Callout>
    </div>
  )
}
