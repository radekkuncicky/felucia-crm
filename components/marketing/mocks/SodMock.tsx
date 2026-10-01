import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_LIDE, DEMO_TERMIN } from '../demoData'
import { DocChip, MockFigure, StatusPill, UiFrame } from '../primitives'
import { IconShield } from '../icons'
import { Callout, SignatureScribble } from './parts'

// Důkazy podpisu odpovídají tomu, co aplikace skutečně ukládá (docs/homepage-facts.md, bod 3).
// IP z dokumentačního rozsahu (RFC 5737), otisk zkrácený.
const DUKAZY: { label: string; value: string; mobil: boolean }[] = [
  { label: 'Čas podpisu', value: DEMO_TERMIN.sodKlient, mobil: true },
  { label: 'Telefon ověřený SMS kódem', value: '+420 *** *** 101', mobil: true },
  { label: 'IP adresa', value: '203.0.113.24', mobil: false },
  { label: 'Otisk dokumentu (SHA-256)', value: '3f9a 61c0 ... 8be2 c21e', mobil: false },
]

/** Smlouva o dílo se dvěma podpisy; klient ověřený SMS kódem a uložené důkazy. */
export function SodMock({ className }: { className?: string }) {
  return (
    <div className={className}>
      <MockFigure label={`Ukázka smlouvy o dílo ${DEMO_DOKLADY.sod}: podepsáno za zhotovitele i objednatelkou ${DEMO_KLIENT.jmeno}, elektronický podpis ověřený SMS kódem; uložen čas, ověřený telefon, IP adresa a otisk dokumentu.`}>
        <UiFrame title={`Smlouva o dílo ${DEMO_DOKLADY.sod}`} meta={DEMO_DOKLADY.op}>
          <div className="space-y-4 p-4 sm:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <DocChip kind="sod">{DEMO_DOKLADY.sod}</DocChip>
              <StatusPill tone="green" dot className="ml-auto">Podepsáno</StatusPill>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <SignatureCard
                heading="Podepsáno elektronicky za zhotovitele"
                jmeno={DEMO_LIDE.vedouci.jmeno}
                cas={DEMO_TERMIN.sodZhotovitel}
                className="hidden sm:block"
              />
              <SignatureCard
                heading="Podepsáno elektronicky objednatelem"
                jmeno={DEMO_KLIENT.jmeno}
                cas={DEMO_TERMIN.sodKlient}
                overeno
              />
            </div>

            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-lg border border-dashed border-[var(--mk-line-strong)] p-3 sm:grid-cols-2">
              {DUKAZY.map(d => (
                <div key={d.label} className={d.mobil ? 'min-w-0' : 'hidden min-w-0 sm:block'}>
                  <dt className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--mk-faint)]">{d.label}</dt>
                  <dd className="mk-doc truncate text-[12.5px] text-[var(--mk-ink)]">{d.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </UiFrame>
      </MockFigure>
      <Callout>Elektronický podpis ověřený SMS kódem. Ke každému podpisu klienta se uloží čas, ověřené telefonní číslo, IP adresa a otisk dokumentu.</Callout>
    </div>
  )
}

function SignatureCard({ heading, jmeno, cas, overeno = false, className }: {
  heading: string
  jmeno: string
  cas: string
  overeno?: boolean
  className?: string
}) {
  return (
    <div className={`rounded-lg border border-[var(--mk-line)] bg-[var(--mk-bg)] p-3 ${className ?? ''}`}>
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[var(--mk-green-ink)]">{heading}</p>
      <SignatureScribble className="my-1 h-10 w-36 text-[var(--mk-ink)]" />
      <p className="text-[13.5px] font-semibold">{jmeno}</p>
      <p className="mk-doc text-[11.5px] text-[var(--mk-muted)]">{cas}</p>
      {overeno && (
        <span className="mt-2 inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--mk-green-ink)]">
          <IconShield className="h-3.5 w-3.5" /> Ověřeno SMS kódem
        </span>
      )}
    </div>
  )
}
