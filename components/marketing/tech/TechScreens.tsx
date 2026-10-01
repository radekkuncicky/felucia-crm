// Obrazovky aplikace Felucia Tech v CSS telefonu. Názvy záložek, záhlaví a tlačítek
// odpovídají appce (Můj den, Navigovat na stavbu, Zavolat, Fotodokumentace,
// Klient přítomen, Podepsat a odeslat). Ceny se při montáži technikovi nezobrazují.

import { cn } from '@/lib/cn'
import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_LIDE, DEMO_MATERIAL, DEMO_TECH, DEMO_TECHNOLOGIE, DEMO_TERMIN, mnozstvi } from '../demoData'
import { DocChip, MockFigure, PhoneFrame } from '../primitives'
import { IconCamera, IconCheck, IconDoc, IconHome, IconList, IconNavigate, IconPhone, IconUser, IconWrench } from '../icons'
import { SignatureScribble } from '../mocks/parts'

type Tab = 'Dnes' | 'Zakázky' | 'Servis' | 'Já'
const TABS: { t: Tab; icon: (p: { className?: string }) => React.ReactElement }[] = [
  { t: 'Dnes', icon: IconHome },
  { t: 'Zakázky', icon: IconList },
  { t: 'Servis', icon: IconWrench },
  { t: 'Já', icon: IconUser },
]

function TechShell({ label, title, back, active, children, className }: {
  label: string
  title: string
  back?: string
  active: Tab
  children: React.ReactNode
  className?: string
}) {
  return (
    <MockFigure label={label} grid={false} padded={false} className={cn('pt-9', className)}>
      <PhoneFrame>
        <div className="shrink-0 border-b border-[var(--mk-line)] px-4 pb-2.5 pt-1">
          {back && <p className="text-[11px] font-medium text-[var(--mk-green-ink)]">{back}</p>}
          <p className="mk-display text-[19px] font-semibold leading-tight text-[var(--mk-ink)]">{title}</p>
        </div>
        <div className="min-h-0 flex-1 space-y-2.5 overflow-hidden bg-[var(--mk-bg)] px-3 py-3">{children}</div>
        <nav className="grid shrink-0 grid-cols-4 border-t border-[var(--mk-line)] bg-[var(--mk-surface)] pb-3 pt-1.5" aria-hidden="true">
          {TABS.map(({ t, icon: Icon }) => (
            <span key={t} className={cn('flex flex-col items-center gap-0.5 text-[10px] font-semibold', t === active ? 'text-[var(--mk-green-ink)]' : 'text-[var(--mk-faint)]')}>
              <Icon className="h-[18px] w-[18px]" />
              {t}
            </span>
          ))}
        </nav>
      </PhoneFrame>
    </MockFigure>
  )
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('rounded-xl border border-[var(--mk-line)] bg-[var(--mk-surface)] p-3', className)}>{children}</div>
}

function PhoneButton({ children, primary = false, className }: { children: React.ReactNode; primary?: boolean; className?: string }) {
  return (
    <span className={cn(
      'flex items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-[12px] font-semibold',
      primary ? 'bg-[var(--mk-green-ink)] text-white' : 'border border-[var(--mk-line-strong)] text-[var(--mk-ink)]',
      className,
    )}>
      {children}
    </span>
  )
}

const Mini = ({ children }: { children: React.ReactNode }) => (
  <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--mk-faint)]">{children}</p>
)

// ─── Můj den ─────────────────────────────────────────────────────────────────

export function TechMujDen({ className }: { className?: string }) {
  const d = DEMO_TECH.dalsiZastavka
  return (
    <TechShell
      className={className}
      active="Dnes"
      title="Můj den"
      label={`Ukázka aplikace Felucia Tech, obrazovka Můj den: v ${DEMO_TERMIN.cas} zakázka ${DEMO_DOKLADY.zakazka}, ${DEMO_KLIENT.jmeno}, ${DEMO_KLIENT.mesto}, tlačítka Navigovat na stavbu a Zavolat.`}
    >
      <p className="px-1 text-[12px] font-medium text-[var(--mk-muted)]">{DEMO_TERMIN.den}</p>
      <Card className="border-[var(--mk-green-line)]">
        <div className="flex items-center justify-between">
          <span className="mk-doc text-[12px] font-semibold text-[var(--mk-green-ink)]">{DEMO_TERMIN.cas}</span>
          <DocChip kind="zakazka" size="sm">{DEMO_DOKLADY.zakazka}</DocChip>
        </div>
        <p className="mt-1.5 text-[14px] font-semibold">{DEMO_KLIENT.jmeno}</p>
        <p className="text-[12px] text-[var(--mk-muted)]">{DEMO_TECHNOLOGIE} - {DEMO_KLIENT.mesto}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          <PhoneButton primary><IconNavigate className="h-3.5 w-3.5" />Navigovat</PhoneButton>
          <PhoneButton><IconPhone className="h-3.5 w-3.5" />Zavolat</PhoneButton>
        </div>
      </Card>
      <Mini>Dnes také</Mini>
      <Card className="hidden sm:block">
        <div className="flex items-center justify-between">
          <span className="mk-doc text-[12px] text-[var(--mk-muted)]">{d.cas}</span>
          <DocChip kind="servis" size="sm">{d.cislo}</DocChip>
        </div>
        <p className="mt-1 text-[13px] font-semibold">{d.typ}</p>
        <p className="text-[12px] text-[var(--mk-muted)]">{d.misto}</p>
      </Card>
    </TechShell>
  )
}

// ─── Detail zakázky ──────────────────────────────────────────────────────────

export function TechZakazka({ className }: { className?: string }) {
  return (
    <TechShell
      className={className}
      active="Zakázky"
      back="Zakázky"
      title={`Zakázka ${DEMO_DOKLADY.zakazka}`}
      label={`Ukázka aplikace Felucia Tech, detail zakázky ${DEMO_DOKLADY.zakazka}: místo stavby ${DEMO_KLIENT.mesto} s navigací, kontakt na klientku, pokyny a podklady.`}
    >
      <Card>
        <Mini>Adresa stavby</Mini>
        <p className="mt-0.5 text-[13.5px] font-semibold">{DEMO_KLIENT.mesto}</p>
        <PhoneButton primary className="mt-2"><IconNavigate className="h-3.5 w-3.5" />Navigovat na stavbu</PhoneButton>
      </Card>
      <Card className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Mini>Klient</Mini>
          <p className="truncate text-[13px] font-semibold">{DEMO_KLIENT.jmeno}</p>
        </div>
        <PhoneButton className="shrink-0"><IconPhone className="h-3.5 w-3.5" />Zavolat</PhoneButton>
      </Card>
      <Card>
        <Mini>Pokyny</Mini>
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--mk-ink)]">{DEMO_TECH.pokyny}</p>
      </Card>
      <Card className="hidden sm:block">
        <Mini>Podklady</Mini>
        <p className="mt-1 flex items-center gap-1.5 text-[12px]">
          <IconDoc className="h-3.5 w-3.5 shrink-0 text-[var(--mk-muted)]" />
          <span className="truncate">{DEMO_TECH.podklady[0]}</span>
          <span className="shrink-0 text-[var(--mk-muted)]">+{DEMO_TECH.podklady.length - 1}</span>
        </p>
      </Card>
    </TechShell>
  )
}

// ─── Materiál (položky bez cen) ──────────────────────────────────────────────

export function TechMaterial({ className }: { className?: string }) {
  const hotovo = new Set(['tc', 'zas'])
  return (
    <TechShell
      className={className}
      active="Zakázky"
      back={`Zakázka ${DEMO_DOKLADY.zakazka}`}
      title="Položky"
      label={`Ukázka aplikace Felucia Tech, položky zakázky ${DEMO_DOKLADY.zakazka} k odškrtání: názvy a množství bez cen.`}
    >
      <p className="px-1 text-[12px] text-[var(--mk-muted)]">Hotovo 2 ze {DEMO_MATERIAL.length}</p>
      {DEMO_MATERIAL.map(p => (
        <Card key={p.id} className="flex items-center gap-2.5 py-2.5">
          <span className={cn(
            'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md border-2',
            hotovo.has(p.id) ? 'border-[var(--mk-green-ink)] bg-[var(--mk-green-ink)] text-white' : 'border-[var(--mk-line-strong)]',
          )}>
            {hotovo.has(p.id) && <IconCheck className="h-3.5 w-3.5" />}
          </span>
          <span className={cn('min-w-0 flex-1 truncate text-[12.5px] font-medium', hotovo.has(p.id) && 'text-[var(--mk-muted)] line-through')}>{p.kratce}</span>
          <span className="mk-doc shrink-0 text-[11.5px] text-[var(--mk-muted)]">{mnozstvi(p.mnozstvi, p.jednotka)}</span>
        </Card>
      ))}
    </TechShell>
  )
}

// ─── Fotky ───────────────────────────────────────────────────────────────────

/** Místo fotek jednoduché výkresové dlaždice (žádné fotky ani screenshoty). */
function FotoTile({ label, i }: { label: string; i: number }) {
  return (
    <div className="mk-grid relative aspect-square overflow-hidden rounded-lg border border-[var(--mk-line)]">
      <svg viewBox="0 0 60 60" className="absolute inset-0 h-full w-full text-[var(--mk-line-strong)]" aria-hidden="true">
        {i % 3 === 0 && <><rect x="12" y="18" width="36" height="24" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="38" cy="30" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" /></>}
        {i % 3 === 1 && <><path d="M10 44h40M16 44V22l14-8 14 8v22" fill="none" stroke="currentColor" strokeWidth="1.5" /></>}
        {i % 3 === 2 && <><path d="M12 30h36M30 12v36" fill="none" stroke="currentColor" strokeWidth="1.5" /><circle cx="30" cy="30" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" /></>}
      </svg>
      <span className="absolute inset-x-1 bottom-1 truncate rounded bg-[var(--mk-surface)] px-1 py-0.5 text-[9px] font-medium text-[var(--mk-ink)]">{label}</span>
    </div>
  )
}

export function TechFotky({ className }: { className?: string }) {
  return (
    <TechShell
      className={className}
      active="Zakázky"
      back={`Zakázka ${DEMO_DOKLADY.zakazka}`}
      title="Fotodokumentace"
      label={`Ukázka aplikace Felucia Tech, fotodokumentace zakázky ${DEMO_DOKLADY.zakazka}: ${DEMO_TECH.fotky.length} fotek a tlačítko Vyfotit.`}
    >
      <p className="px-1 text-[12px] text-[var(--mk-muted)]">{DEMO_TECH.fotky.length} fotek</p>
      <div className="grid grid-cols-3 gap-1.5">
        {DEMO_TECH.fotky.map((f, i) => <FotoTile key={f} label={f} i={i} />)}
      </div>
      <PhoneButton primary><IconCamera className="h-3.5 w-3.5" />Vyfotit</PhoneButton>
    </TechShell>
  )
}

// ─── Podpis klienta (políčko na výšku) ───────────────────────────────────────

export function TechPodpis({ className }: { className?: string }) {
  return (
    <TechShell
      className={className}
      active="Zakázky"
      back={`Zakázka ${DEMO_DOKLADY.zakazka}`}
      title="Předávací protokol"
      label={`Ukázka aplikace Felucia Tech, předávací protokol ${DEMO_DOKLADY.protokol}: klient přítomen, podpis klientky ${DEMO_KLIENT.jmeno} v políčku na displeji, tlačítko Podepsat a odeslat.`}
    >
      <div className="flex items-center justify-between px-1">
        <DocChip kind="protokol" size="sm">{DEMO_DOKLADY.protokol}</DocChip>
        <span className="text-[11.5px] text-[var(--mk-muted)]">{DEMO_LIDE.technik.jmeno}</span>
      </div>
      <Card className="flex items-center justify-between py-2.5">
        <span className="text-[12.5px] font-medium">Klient přítomen</span>
        <span className="flex h-5 w-9 items-center rounded-full bg-[var(--mk-green-ink)] p-0.5">
          <span className="ml-auto h-4 w-4 rounded-full bg-white" />
        </span>
      </Card>
      <Card className="hidden py-2.5 sm:block">
        <p className="text-[12px] text-[var(--mk-muted)]">Izolované potrubí</p>
        <p className="mk-doc text-[12px]">Plánováno 10 m <span className="font-bold text-[var(--mk-diff-ink)]">Použito 12 m</span></p>
      </Card>
      <div>
        <Mini>Podpis klienta</Mini>
        <div className="mt-1 flex h-[104px] items-center justify-center rounded-xl border-2 border-dashed border-[var(--mk-line-strong)] bg-[var(--mk-surface)]">
          <SignatureScribble className="h-12 w-40 text-[var(--mk-ink)]" />
        </div>
        <p className="mt-1 text-center text-[11px] text-[var(--mk-muted)]">{DEMO_KLIENT.jmeno}</p>
      </div>
      <PhoneButton primary>Podepsat a odeslat</PhoneButton>
    </TechShell>
  )
}

export const TECH_OBRAZOVKY = [
  { id: 'muj-den', nazev: 'Můj den', Komponenta: TechMujDen },
  { id: 'zakazka', nazev: 'Detail zakázky', Komponenta: TechZakazka },
  { id: 'material', nazev: 'Položky', Komponenta: TechMaterial },
  { id: 'fotky', nazev: 'Fotky', Komponenta: TechFotky },
  { id: 'podpis', nazev: 'Podpis zákazníka', Komponenta: TechPodpis },
] as const

