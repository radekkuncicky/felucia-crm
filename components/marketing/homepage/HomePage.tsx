// Nová homepage felucia.io (část 3/4). Serverová komponenta; klientské jsou jen
// hlavička, hero smyčka, průvodce, přepínač telefonu, formulář a náběh sekcí.
// Texty: ./content.ts, ceny a limity: ./Cenik.tsx, FAQ: lib/landing.ts (FAQS).

import Link from 'next/link'
import { CONTACT, FAQS, OPERATOR } from '@/lib/landing'
import { MarketingRoot } from '../MarketingRoot'
import { LiveZakazkaHero } from '../LiveZakazkaHero'
import { DocChip, LeafMark, Section, SectionHeading } from '../primitives'
import { DEMO_DOKLADY } from '../demoData'
import {
  IconArrowRight, IconBox, IconCalendar, IconChat, IconCheck, IconDoc, IconHome, IconList,
  IconPen, IconShield, IconUser, IconWrench,
} from '../icons'
import { ObchodniPripadMock } from '../mocks/ObchodniPripadMock'
import { SodMock } from '../mocks/SodMock'
import { MaterialMock } from '../mocks/MaterialMock'
import { VyuctovaniMock } from '../mocks/VyuctovaniMock'
import { ServisPlanMock } from '../mocks/ServisPlanMock'
import { ProtokolDiffMock } from '../mocks/ProtokolDiffMock'
import { ZakazkaMock } from '../mocks/ZakazkaMock'
import { ServisZarizeniMock } from '../mocks/ServisZarizeniMock'
import { DasaChatMock } from '../mocks/DasaChatMock'
import { TechFotky, TechMaterial, TechMujDen, TechPodpis, TechZakazka } from '../tech/TechScreens'
import { SiteHeader } from './SiteHeader'
import { Pruvodce, type PruvodceKrok } from './Pruvodce'
import { TechPhoneSwitcher } from './TechPhoneSwitcher'
import { DemoForm } from './DemoForm'
import { RevealObserver } from './RevealObserver'
import { Cenik, podpisDostupnostVeta, servisPlany } from './Cenik'
import {
  CENY, DASA, DATA, DETAILY_H2, HERO, JAK, KROKY, NAV, OBORY, PATICKA, PENIZE, PLAN_VS, SERVIS, TECHNICI, UKAZKA, type KrokId,
} from './content'

/**
 * Felucia Tech v App Store. ID 6779400065 zatím veřejně nevede nikam (apps.apple.com
 * vrací 404, iTunes lookup nic nenajde) - odznak se ukáže až po přepnutí na true.
 */
const APP_STORE_URL = 'https://apps.apple.com/cz/app/id6779400065'
const APP_STORE_ZVEREJNENO = false

const UKAZKY_KROKU: Record<KrokId, React.ReactNode> = {
  obchod: <ObchodniPripadMock callout={false} />,
  smlouva: <SodMock callout={false} />,
  priprava: <MaterialMock callout={false} />,
  montaz: <TechZakazka />,
  predani: <VyuctovaniMock callout={false} />,
  servis: <ServisPlanMock />,
}

function pruvodceKroky(): PruvodceKrok[] {
  return KROKY.map(k => ({
    ...k,
    pozn: k.id === 'smlouva'
      ? `Elektronický podpis: ${podpisDostupnostVeta()}`
      : k.id === 'servis' ? `Servisní modul je v plánech ${servisPlany()}.` : undefined,
    ukazka: UKAZKY_KROKU[k.id],
  }))
}

// Mřížka detailů - jen funkce se stavem ANO v docs/homepage-facts.md.
const DETAILY: { icon: (p: { className?: string }) => React.ReactElement; titulek: string; text: string }[] = [
  { icon: IconShield, titulek: 'Elektronický podpis ověřený SMS kódem', text: 'Ke každému podpisu klienta se uloží čas, ověřené telefonní číslo, IP adresa a otisk dokumentu. Průběh je v historii smlouvy.' },
  { icon: IconDoc, titulek: 'Šablony smluv s proměnnými', text: 'Jméno klienta, adresa díla, cena a termín se do SOD doplní samy. Před odesláním náhled.' },
  { icon: IconDoc, titulek: 'PDF nabídky ve vašem designu', text: 'Vlastní šablona nabídky, PDF odejde klientovi s vaším vzhledem.' },
  { icon: IconList, titulek: 'Kopírování nabídek', text: 'Hotovou nabídku zduplikujete nebo zkopírujete do jiného obchodního případu.' },
  { icon: IconUser, titulek: 'Hlídání duplicitních klientů', text: 'Při zakládání klienta Felucia porovná telefon, e-mail a jméno s evidencí.' },
  { icon: IconBox, titulek: 'Stav materiálu u zakázky', text: 'U každé položky je vidět Čeká, Objednáno, Rezervováno nebo Vydáno.' },
  { icon: IconCheck, titulek: 'Plán vs skutečnost v protokolu', text: 'Technik zapíše skutečně použité množství, protokol ho ukáže vedle plánovaného.' },
  { icon: IconCheck, titulek: 'Schvalování protokolů a vyúčtování', text: 'Protokol i vyúčtování schvaluje Manažer zakázek nebo Správce.' },
  { icon: IconHome, titulek: 'Stavový pruh zakázky', text: 'Nová, Přiřazena, V realizaci, Předána, Vyúčtována, Hotovo. U etap se pruh prodlužuje.' },
  { icon: IconChat, titulek: 'Historie zakázky', text: 'Komentáře a aktivita zakázky na jednom místě.' },
  { icon: IconWrench, titulek: 'Zařízení, záruky a kontrakty', text: 'Výrobní číslo, záruka do, servisní kontrakt a další prohlídka u každého zařízení.' },
  { icon: IconCalendar, titulek: 'Další prohlídka sama', text: 'Po dokončení prohlídky z kontraktu se založí další podle intervalu.' },
  { icon: IconUser, titulek: 'Role a oprávnění', text: 'Správce, Manažer zakázek, Obchodník, Hlavní technik a Technik. Každý vidí jen to, co potřebuje.' },
  { icon: IconHome, titulek: 'Vlastní subdoména', text: 'Každá firma pracuje na své adrese firma.felucia.io.' },
  { icon: IconShield, titulek: 'Anonymizace klienta podle GDPR', text: 'Osobní údaje klienta nevratně anonymizujete, obchodní historie zůstane.' },
  { icon: IconPen, titulek: 'Podpis klienta na displeji', text: 'Předávací protokol podepíše klient přímo v telefonu technika.' },
]

const DATA_BODY: { titulek: string; text: React.ReactNode }[] = [
  { titulek: 'Oddělený prostor firmy', text: 'Každá firma má vlastní subdoménu a její data jsou od ostatních oddělená v aplikaci i přímo v databázi.' },
  { titulek: 'Servery v EU', text: 'Felucia běží na vlastním serveru u společnosti Hetzner v Evropské unii.' },
  { titulek: 'Zálohy', text: 'Databázi zálohujeme každý den, šifrovaně, 14 dní zpětně a s kopií mimo server.' },
  { titulek: 'GDPR', text: <>Klienta můžete anonymizovat, obchodní historie zůstane. Podrobnosti v <Link href="/privacy" className="font-semibold text-[var(--mk-green-ink)] underline underline-offset-2">zásadách ochrany osobních údajů</Link>.</> },
  { titulek: 'Kdo za Felucií stojí', text: `Provozovatel ${OPERATOR.name}, IČO ${OPERATOR.ico}, ${OPERATOR.city}. ${PATICKA.puvod}` },
]

function Tlacitko({ href, children, varianta = 'primarni' }: { href: string; children: React.ReactNode; varianta?: 'primarni' | 'sekundarni' }) {
  return (
    <a
      href={href}
      className={
        varianta === 'primarni'
          ? 'inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--mk-green-ink)] px-5 py-3 text-[15.5px] font-semibold text-white hover:bg-[var(--mk-ink)]'
          : 'inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] px-5 py-3 text-[15.5px] font-semibold text-[var(--mk-ink)] hover:border-[var(--mk-ink)]'
      }
    >
      {children}
    </a>
  )
}

export function HomePage() {
  return (
    <MarketingRoot>
      <a href="#obsah" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[var(--mk-surface)] focus:px-3 focus:py-2">
        Přeskočit na obsah
      </a>
      {/* 6.1 Hlavička */}
      <SiteHeader />

      <main id="obsah">
        {/* 6.2 Hero */}
        <section aria-labelledby="hero-h1" className="pb-10 pt-8 sm:pt-14">
          <div className="mk-container grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,520px)] lg:gap-14">
            <div>
              <p className="mk-doc text-[12.5px] font-medium uppercase tracking-[0.08em] text-[var(--mk-green-ink)]">{HERO.nadtitulek}</p>
              <h1 id="hero-h1" className="mk-display mt-4 text-[clamp(34px,5.4vw,58px)] font-semibold leading-[1.05]">{HERO.h1}</h1>
              <p className="mt-5 max-w-[620px] text-[17.5px] leading-relaxed text-[var(--mk-muted)]">{HERO.podtitulek}</p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Tlacitko href="#ukazka">{HERO.primarni}</Tlacitko>
                <Tlacitko href="#jak-to-funguje" varianta="sekundarni">{HERO.sekundarni}</Tlacitko>
              </div>
              <p className="mt-4 text-[13.5px] text-[var(--mk-muted)]">{HERO.drobne}</p>
            </div>
            <LiveZakazkaHero />
          </div>
        </section>

        {/* Pás oborů - statický */}
        <div className="border-y border-[var(--mk-line)] bg-[var(--mk-surface)]">
          <ul className="mk-container flex flex-wrap items-center justify-center gap-x-6 gap-y-2 py-4 text-[14px] font-medium text-[var(--mk-muted)]" aria-label="Obory">
            {OBORY.map(o => (
              <li key={o} className="flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--mk-green)]" aria-hidden="true" />
                {o}
              </li>
            ))}
          </ul>
        </div>

        {/* 6.3 Kde utíkají peníze */}
        <Section labelledBy="penize-h2">
          <SectionHeading id="penize-h2" title="Kde montážním firmám utíkají peníze" />
          <ul className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" data-reveal>
            {PENIZE.map(p => (
              <li key={p.titulek} className="flex flex-col rounded-[var(--mk-radius)] border border-[var(--mk-line)] bg-[var(--mk-surface)] p-5">
                <h3 className="mk-display text-[18px] font-semibold leading-snug">{p.titulek}</h3>
                <p className="mt-2 flex-1 text-[15px] leading-relaxed text-[var(--mk-muted)]">{p.text}</p>
                <a href={`#krok-${p.krok}`} className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-semibold text-[var(--mk-green-ink)] hover:underline">
                  Řeší krok {p.krokNazev} <IconArrowRight className="h-3.5 w-3.5" />
                </a>
              </li>
            ))}
          </ul>
        </Section>

        {/* 6.4 Jak to funguje */}
        <Section id="jak-to-funguje" tone="muted" labelledBy="jak-h2">
          <SectionHeading id="jak-h2" eyebrow="Jak to funguje" title={JAK.h2} lead={JAK.podtitulek} />
          <div className="mt-10" data-reveal>
            <Pruvodce kroky={pruvodceKroky()} />
          </div>
        </Section>

        {/* 6.5 Plán vs skutečnost */}
        <Section labelledBy="planvs-h2">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <SectionHeading id="planvs-h2" eyebrow={`Předávací protokol ${DEMO_DOKLADY.protokol}`} title={PLAN_VS.h2} />
              {PLAN_VS.odstavce.map(o => (
                <p key={o} className="mt-5 text-[16.5px] leading-relaxed text-[var(--mk-muted)]">{o}</p>
              ))}
            </div>
            <div data-reveal><ProtokolDiffMock callout={false} /></div>
          </div>
        </Section>

        {/* 6.6 Kancelář a terén */}
        <Section id="technici" tone="muted" labelledBy="technici-h2">
          <SectionHeading id="technici-h2" eyebrow="Kancelář a terén" title={TECHNICI.h2} />
          <div className="mt-10 grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="space-y-8">
              <div data-reveal><ZakazkaMock callout={false} /></div>
              <div>
                <h3 className="mk-display text-[20px] font-semibold">Aplikace Felucia Tech pro techniky</h3>
                <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-2.5 sm:grid-cols-2">
                  {TECHNICI.body.map(b => (
                    <li key={b} className="flex gap-2.5 text-[15px] leading-relaxed">
                      <IconCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--mk-green-ink)]" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-5 rounded-[var(--mk-radius-sm)] border border-dashed border-[var(--mk-line-strong)] p-4 text-[14.5px] leading-relaxed">
                  <span className="font-semibold">Bez signálu:</span> {TECHNICI.offline}
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  {APP_STORE_ZVEREJNENO ? (
                    <a href={APP_STORE_URL} className="inline-flex flex-col rounded-lg bg-[var(--mk-ink)] px-4 py-2 leading-tight text-white" rel="noopener">
                      <span className="text-[11px]">Stáhnout v</span>
                      <span className="text-[17px] font-semibold">App Store</span>
                    </a>
                  ) : (
                    <span className="text-[14.5px] font-medium">Aplikace Felucia Tech je pro iOS.</span>
                  )}
                  <span className="text-[14px] text-[var(--mk-muted)]">{TECHNICI.android}</span>
                </div>
              </div>
            </div>
            <div data-reveal>
              <TechPhoneSwitcher
                obrazovky={[
                  { id: 'muj-den', nazev: 'Můj den', node: <TechMujDen /> },
                  { id: 'zakazka', nazev: 'Detail zakázky', node: <TechZakazka /> },
                  { id: 'material', nazev: 'Materiál', node: <TechMaterial /> },
                  { id: 'fotky', nazev: 'Fotky', node: <TechFotky /> },
                  { id: 'podpis', nazev: 'Podpis zákazníka', node: <TechPodpis /> },
                ]}
              />
            </div>
          </div>
        </Section>

        {/* 6.7 Servis */}
        <Section id="servis" labelledBy="servis-h2">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <SectionHeading id="servis-h2" eyebrow="Servis" title={SERVIS.h2} lead={SERVIS.text} />
              <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] px-3 py-1.5 text-[13.5px] font-medium">
                <IconWrench className="h-4 w-4 text-[var(--mk-green-ink)]" />
                Servisní modul je v plánech {servisPlany()}.
              </p>
            </div>
            <div data-reveal><ServisZarizeniMock callout={false} /></div>
          </div>
        </Section>

        {/* 6.8 Detaily */}
        <Section id="funkce" tone="muted" labelledBy="funkce-h2">
          <SectionHeading id="funkce-h2" eyebrow="Funkce" title={DETAILY_H2} />
          <ul className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-[var(--mk-radius)] border border-[var(--mk-line)] bg-[var(--mk-line)] sm:grid-cols-2 lg:grid-cols-4" data-reveal>
            {DETAILY.map(d => (
              <li key={d.titulek} className="bg-[var(--mk-surface)] p-5">
                <d.icon className="h-5 w-5 text-[var(--mk-green-ink)]" />
                <h3 className="mt-3 text-[15.5px] font-semibold leading-snug">{d.titulek}</h3>
                <p className="mt-1.5 text-[14px] leading-relaxed text-[var(--mk-muted)]">{d.text}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] text-[var(--mk-muted)]">Elektronický podpis: {podpisDostupnostVeta()} Zařízení a kontrakty: servisní modul v plánech {servisPlany()}.</p>
        </Section>

        {/* 6.9 Dáša */}
        <Section tone="dark" labelledBy="dasa-h2">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <div>
              <SectionHeading id="dasa-h2" eyebrow="AI asistentka" title={DASA.h2} lead={DASA.text} />
              <p className="mt-6 text-[15px] font-semibold">Co Dáša umí:</p>
              <ul className="mt-3 space-y-2">
                {DASA.umi.map(u => (
                  <li key={u} className="flex gap-2.5 text-[15px] text-[var(--mk-muted)]">
                    <IconCheck className="mt-1 h-4 w-4 shrink-0 text-[var(--mk-green-ink)]" />
                    <span>{u.charAt(0).toUpperCase() + u.slice(1)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal><DasaChatMock /></div>
          </div>
        </Section>

        {/* 6.10 Data a důvěra */}
        <Section labelledBy="data-h2">
          <SectionHeading id="data-h2" title={DATA.h2} />
          <dl className="mt-10 grid grid-cols-1 gap-x-10 gap-y-6 sm:grid-cols-2 lg:grid-cols-3" data-reveal>
            {DATA_BODY.map(d => (
              <div key={d.titulek} className="border-t border-[var(--mk-line-strong)] pt-4">
                <dt className="font-semibold">{d.titulek}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-[var(--mk-muted)]">{d.text}</dd>
              </div>
            ))}
          </dl>
        </Section>

        {/* 6.11 Ceny */}
        <Section id="ceny" tone="muted" labelledBy="ceny-h2">
          <SectionHeading id="ceny-h2" eyebrow="Ceny" title={CENY.h2} lead={CENY.podtitulek} />
          <div className="mt-10"><Cenik /></div>
        </Section>

        {/* 6.12 FAQ */}
        <Section id="faq" labelledBy="faq-h2">
          <SectionHeading id="faq-h2" eyebrow="FAQ" title="Časté otázky" />
          <div className="mt-8 max-w-[820px] divide-y divide-[var(--mk-line)] border-y border-[var(--mk-line)]">
            {FAQS.map(f => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer items-start justify-between gap-4 py-4 text-[16px] font-semibold">
                  <h3>{f.q}</h3>
                  <span aria-hidden="true" className="mt-0.5 text-[20px] leading-none text-[var(--mk-green-ink)] transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="pb-5 pr-8 text-[15.5px] leading-relaxed text-[var(--mk-muted)]">{f.a}</p>
              </details>
            ))}
          </div>
        </Section>

        {/* 6.13 Ukázka */}
        <Section id="ukazka" tone="muted" labelledBy="ukazka-h2">
          <div className="grid grid-cols-1 items-start gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
            <div>
              <SectionHeading id="ukazka-h2" eyebrow="Ukázka" title={UKAZKA.h2} lead={UKAZKA.text} />
              <ol className="mt-8 space-y-4">
                {UKAZKA.kroky.map((k, i) => (
                  <li key={k} className="flex gap-3">
                    <span className="mk-doc flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[13px]">{i + 1}</span>
                    <span className="pt-0.5 text-[15.5px]">{k}</span>
                  </li>
                ))}
              </ol>
              <div className="mt-8 flex flex-col gap-2 text-[15px]">
                <a href={`mailto:${CONTACT.email}`} className="font-semibold text-[var(--mk-green-ink)] hover:underline">{CONTACT.email}</a>
                <a href={`tel:${CONTACT.phone}`} className="font-semibold text-[var(--mk-green-ink)] hover:underline">{CONTACT.phoneDisplay}</a>
              </div>
            </div>
            <div className="rounded-[var(--mk-radius)] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] p-5 shadow-[var(--mk-shadow)] sm:p-8">
              <DemoForm />
            </div>
          </div>
        </Section>
      </main>

      {/* 6.14 Patička */}
      <footer className="mk-dark border-t border-[var(--mk-line)]">
        <div className="mk-container grid grid-cols-1 gap-10 py-14 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" className="inline-flex items-center gap-2 rounded-md">
              <LeafMark className="h-7 w-7" />
              <span className="mk-display text-[20px] font-bold">felucia</span>
            </Link>
            <p className="mt-4 max-w-[360px] text-[14px] leading-relaxed text-[var(--mk-muted)]">{PATICKA.popis}</p>
            <div className="mt-4 flex flex-wrap gap-1.5">
              <DocChip kind="op" size="sm">{DEMO_DOKLADY.op}</DocChip>
              <DocChip kind="zakazka" size="sm">{DEMO_DOKLADY.zakazka}</DocChip>
              <DocChip kind="servis" size="sm">{DEMO_DOKLADY.servis}</DocChip>
            </div>
          </div>
          <nav aria-label="Produkt">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--mk-muted)]">Produkt</p>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              {NAV.map(n => <li key={n.href}><a href={n.href} className="hover:underline">{n.label}</a></li>)}
            </ul>
          </nav>
          <nav aria-label="Účet">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--mk-muted)]">Účet</p>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><a href="#ukazka" className="hover:underline">Domluvit ukázku</a></li>
              <li><Link href="/auth/signin" className="hover:underline">Přihlásit se</Link></li>
              <li><a href={`mailto:${CONTACT.email}`} className="hover:underline">{CONTACT.email}</a></li>
              <li><a href={`tel:${CONTACT.phone}`} className="hover:underline">{CONTACT.phoneDisplay}</a></li>
            </ul>
          </nav>
          <nav aria-label="Společnost">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--mk-muted)]">Společnost</p>
            <ul className="mt-4 space-y-2.5 text-[14px]">
              <li><Link href="/terms" className="hover:underline">Podmínky</Link></li>
              <li><Link href="/privacy" className="hover:underline">Soukromí</Link></li>
              <li><Link href="/support" className="hover:underline">Podpora</Link></li>
            </ul>
          </nav>
        </div>
        <div className="mk-container flex flex-wrap items-center justify-between gap-3 border-t border-[var(--mk-line)] py-6 text-[13px] text-[var(--mk-muted)]">
          <p>© {new Date().getFullYear()} Felucia. Provozuje {OPERATOR.name}, IČO {OPERATOR.ico}, {OPERATOR.city}.</p>
          <p>Vše roste.</p>
        </div>
      </footer>

      <RevealObserver />
    </MarketingRoot>
  )
}
