import { DEMO_DOKLADY, DEMO_MATERIAL, MATERIAL_STAVY, mnozstvi, type MaterialStav } from '../demoData'
import { MockFigure, StatusPill, UiFrame, type PillTone } from '../primitives'
import { Callout, StateTrack } from './parts'

const TON: Record<MaterialStav, PillTone> = {
  'Čeká': 'neutral',
  'Objednáno': 'blue',
  'Rezervováno': 'amber',
  'Vydáno': 'green',
}

/** Stav materiálu u položek zakázky (názvy stavů jako v aplikaci). */
export function MaterialMock({ className }: { className?: string }) {
  const vydano = DEMO_MATERIAL.filter(p => p.stav === 'Vydáno').length
  return (
    <div className={className}>
      <MockFigure label={`Ukázka materiálu zakázky ${DEMO_DOKLADY.zakazka}: stavy Čeká, Objednáno, Rezervováno a Vydáno; vydáno ${vydano} ze ${DEMO_MATERIAL.length} položek.`}>
        <UiFrame title={`Zakázka ${DEMO_DOKLADY.zakazka} - Položky`}>
          <div className="space-y-3 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <StateTrack steps={MATERIAL_STAVY} current={3} compact="never" className="hidden sm:block" />
              <span className="mk-doc text-[12.5px] text-[var(--mk-muted)]">Vydáno {vydano}/{DEMO_MATERIAL.length}</span>
            </div>
            <div>
              {DEMO_MATERIAL.map(p => (
                <div key={p.id} className="flex items-center gap-3 border-b border-[var(--mk-line)] py-2.5 last:border-0">
                  <span className="min-w-0 flex-1 truncate text-[13.5px]">
                    <span className="sm:hidden">{p.kratce}</span>
                    <span className="hidden sm:inline">{p.nazev}</span>
                  </span>
                  <span className="mk-doc hidden w-16 text-right text-[12.5px] text-[var(--mk-muted)] sm:block">{mnozstvi(p.mnozstvi, p.jednotka)}</span>
                  <StatusPill tone={TON[p.stav ?? 'Čeká']} dot className="w-[104px] justify-center">{p.stav}</StatusPill>
                </div>
              ))}
            </div>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>U každé položky zakázky je vidět, jestli je materiál objednaný, rezervovaný na skladě, nebo už vydaný.</Callout>
    </div>
  )
}
