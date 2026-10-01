import type { Metadata } from 'next'
import { MarketingRoot } from '@/components/marketing/MarketingRoot'
import { LiveZakazkaHero } from '@/components/marketing/LiveZakazkaHero'
import { BlueprintGrid, DemoBadge, DocChip, PhoneFrame, Section, SectionHeading, StatusPill, UiFrame, type DocKind, type PillTone } from '@/components/marketing/primitives'
import { DEMO_DOKLADY } from '@/components/marketing/demoData'
import { ObchodniPripadMock } from '@/components/marketing/mocks/ObchodniPripadMock'
import { NabidkaMock } from '@/components/marketing/mocks/NabidkaMock'
import { SodMock } from '@/components/marketing/mocks/SodMock'
import { ZakazkaMock } from '@/components/marketing/mocks/ZakazkaMock'
import { MaterialMock } from '@/components/marketing/mocks/MaterialMock'
import { ProtokolDiffMock } from '@/components/marketing/mocks/ProtokolDiffMock'
import { VyuctovaniMock } from '@/components/marketing/mocks/VyuctovaniMock'
import { ServisZarizeniMock } from '@/components/marketing/mocks/ServisZarizeniMock'
import { DasaChatMock } from '@/components/marketing/mocks/DasaChatMock'
import { TechFotky, TechMaterial, TechMujDen, TechPodpis, TechZakazka } from '@/components/marketing/tech/TechScreens'

// DOČASNÁ stránka: přehled design systému a ukázek pro novou homepage.
// Nikde neodkazovaná, není v sitemap, middleware ji drží za přihlášením
// a posílá X-Robots-Tag: noindex. Po spuštění nové homepage smazat.

export const metadata: Metadata = {
  title: 'Homepage - náhled komponent',
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

const DOKLADY: { kind: DocKind; cislo: string; prefix?: string }[] = [
  { kind: 'poptavka', cislo: 'poptávka' },
  { kind: 'op', cislo: DEMO_DOKLADY.op },
  { kind: 'nabidka', cislo: DEMO_DOKLADY.nabidka },
  { kind: 'sod', cislo: DEMO_DOKLADY.sod },
  { kind: 'zakazka', cislo: DEMO_DOKLADY.zakazka, prefix: 'zakázka' },
  { kind: 'protokol', cislo: DEMO_DOKLADY.protokol },
  { kind: 'vyuctovani', cislo: DEMO_DOKLADY.vyuctovani },
  { kind: 'servis', cislo: DEMO_DOKLADY.servis },
  { kind: 'kontrakt', cislo: DEMO_DOKLADY.kontrakt },
]

const PILLS: PillTone[] = ['neutral', 'green', 'blue', 'amber', 'teal', 'violet', 'red']

function Ukazka({ nazev, children }: { nazev: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-[var(--mk-line)] pt-6">
      <h3 className="mk-doc mb-4 text-[13px] font-medium text-[var(--mk-muted)]">{nazev}</h3>
      {children}
    </div>
  )
}

export default function HomepagePreviewPage() {
  return (
    <MarketingRoot>
      <Section>
        <SectionHeading
          as="h1"
          eyebrow="Interní náhled - není veřejné"
          title="Design systém a ukázky nové homepage"
          lead="Všechny komponenty pod sebou. Data jsou smyšlená a berou se z jednoho souboru (components/marketing/demoData.ts)."
        />

        <div className="mt-12 space-y-12">
          <Ukazka nazev="LiveZakazkaHero">
            <div className="max-w-[560px]">
              <LiveZakazkaHero />
            </div>
          </Ukazka>

          <Ukazka nazev="DocChip - typy dokladů a stavy">
            <div className="flex flex-wrap gap-2">
              {DOKLADY.map(d => <DocChip key={d.kind} kind={d.kind} prefix={d.prefix}>{d.cislo}</DocChip>)}
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <DocChip kind="sod" state="done">done</DocChip>
              <DocChip kind="sod" state="current">current</DocChip>
              <DocChip kind="sod" state="todo">todo</DocChip>
              <DocChip kind="op" size="sm">{DEMO_DOKLADY.op}</DocChip>
            </div>
          </Ukazka>

          <Ukazka nazev="StatusPill, DemoBadge">
            <div className="flex flex-wrap items-center gap-2">
              {PILLS.map(t => <StatusPill key={t} tone={t} dot>{t}</StatusPill>)}
              <DemoBadge />
            </div>
          </Ukazka>

          <Ukazka nazev="UiFrame, BlueprintGrid, PhoneFrame">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-[1fr_272px]">
              <BlueprintGrid className="p-4 sm:p-6">
                <UiFrame title="Název obrazovky" meta="Manažer zakázek">
                  <div className="h-28 p-4 text-[13px] text-[var(--mk-muted)]">Obsah obrazovky</div>
                </UiFrame>
              </BlueprintGrid>
              <PhoneFrame>
                <div className="flex flex-1 items-center justify-center text-[13px] text-[var(--mk-muted)]">Displej</div>
              </PhoneFrame>
            </div>
          </Ukazka>

          <Ukazka nazev="ObchodniPripadMock"><ObchodniPripadMock /></Ukazka>
          <Ukazka nazev="NabidkaMock"><NabidkaMock /></Ukazka>
          <Ukazka nazev="SodMock"><SodMock /></Ukazka>
          <Ukazka nazev="ZakazkaMock"><ZakazkaMock /></Ukazka>
          <Ukazka nazev="MaterialMock"><MaterialMock /></Ukazka>
          <Ukazka nazev="ProtokolDiffMock"><ProtokolDiffMock /></Ukazka>
          <Ukazka nazev="VyuctovaniMock"><VyuctovaniMock /></Ukazka>
          <Ukazka nazev="ServisZarizeniMock"><ServisZarizeniMock /></Ukazka>

          <Ukazka nazev="Felucia Tech - TechMujDen, TechZakazka, TechMaterial, TechFotky, TechPodpis">
            <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
              <TechMujDen />
              <TechZakazka />
              <TechMaterial />
              <TechFotky />
              <TechPodpis />
            </div>
          </Ukazka>
        </div>
      </Section>

      <Section tone="dark" labelledBy="preview-dasa">
        <SectionHeading id="preview-dasa" eyebrow="DasaChatMock" title="Tmavá sekce" />
        <div className="mt-8 max-w-[560px]">
          <DasaChatMock />
        </div>
      </Section>

      <Section tone="muted">
        <SectionHeading eyebrow="Section tone=muted" title="SectionHeading" lead="Perex sekce v tlumené barvě, max. šířka 720 px." />
      </Section>
    </MarketingRoot>
  )
}
