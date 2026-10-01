// Základní prvky marketingového webu. Serverové komponenty, barvy jen z tokenů .mk.

import { cn } from '@/lib/cn'

// ─── DocChip ─────────────────────────────────────────────────────────────────

export type DocKind = 'poptavka' | 'op' | 'nabidka' | 'sod' | 'zakazka' | 'protokol' | 'vyuctovani' | 'servis' | 'kontrakt'

// Tlumené odstíny podle typu dokladu (třídy mk-tone-* v marketing.css, text AA).
const DOC_TONE: Record<DocKind, string> = {
  poptavka: 'mk-tone-poptavka',
  op: 'mk-tone-op',
  nabidka: 'mk-tone-nabidka',
  sod: 'mk-tone-sod',
  zakazka: 'mk-tone-zakazka',
  protokol: 'mk-tone-protokol',
  vyuctovani: 'mk-tone-vyuctovani',
  servis: 'mk-tone-servis',
  kontrakt: 'mk-tone-servis',
}

/** Monospace štítek dokladu - vizuální podpis Felucie (jeden propojený záznam). */
export function DocChip({
  kind,
  children,
  prefix,
  size = 'md',
  state = 'done',
  className,
}: {
  kind: DocKind
  children: React.ReactNode
  /** drobný popisek před číslem, např. "zakázka" */
  prefix?: string
  size?: 'sm' | 'md'
  /** done = plný, current = zvýrazněný rámečkem, todo = jen obrys */
  state?: 'done' | 'current' | 'todo'
  className?: string
}) {
  return (
    <span
      className={cn(
        'mk-doc inline-flex items-center gap-1.5 whitespace-nowrap rounded-md border font-medium leading-none',
        size === 'sm' ? 'px-1.5 py-1 text-[11px]' : 'px-2 py-1.5 text-[12.5px]',
        state === 'todo' ? 'border-dashed border-[var(--mk-line-strong)] bg-transparent text-[var(--mk-faint)]' : DOC_TONE[kind],
        state === 'current' && 'ring-2 ring-[var(--mk-green)] ring-offset-1 ring-offset-[var(--mk-surface)]',
        className,
      )}
    >
      {prefix && <span className="font-normal opacity-70">{prefix}</span>}
      {children}
    </span>
  )
}

// ─── StatusPill ──────────────────────────────────────────────────────────────

export type PillTone = 'neutral' | 'green' | 'blue' | 'amber' | 'teal' | 'violet' | 'red'

const PILL_TONE: Record<PillTone, string> = {
  neutral: 'mk-pill-neutral',
  green: 'mk-pill-green',
  blue: 'mk-pill-blue',
  amber: 'mk-pill-amber',
  teal: 'mk-pill-teal',
  violet: 'mk-pill-violet',
  red: 'mk-pill-red',
}

export function StatusPill({ tone = 'neutral', children, dot = false, className }: {
  tone?: PillTone
  children: React.ReactNode
  dot?: boolean
  className?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[11.5px] font-medium leading-5', PILL_TONE[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />}
      {children}
    </span>
  )
}

// ─── DemoBadge ───────────────────────────────────────────────────────────────

export function DemoBadge({ className, onDark = false }: { className?: string; onDark?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border border-dashed px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-[0.06em]',
        onDark ? 'border-[var(--mk-dark-line)] bg-[var(--mk-dark-surface)] text-[var(--mk-dark-muted)]' : 'border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[var(--mk-muted)]',
        className,
      )}
    >
      Ukázková data
    </span>
  )
}

// ─── BlueprintGrid ───────────────────────────────────────────────────────────

/** Jemná rastrová síť pod ukázkami (jako technický výkres). */
export function BlueprintGrid({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn('mk-grid rounded-[var(--mk-radius)] border border-[var(--mk-line)]', className)}>{children}</div>
}

// ─── MockFigure ──────────────────────────────────────────────────────────────

/**
 * Obal kódované ukázky: role="img" s popisem, síť na pozadí a štítek "Ukázková data".
 * Obsah uvnitř je čistě obrazový (čtečka přečte jen aria-label).
 */
export function MockFigure({ label, children, className, padded = true, grid = true }: {
  label: string
  children: React.ReactNode
  className?: string
  padded?: boolean
  grid?: boolean
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        'relative',
        grid && 'mk-grid rounded-[var(--mk-radius)] border border-[var(--mk-line)]',
        padded && 'px-3 pb-3 pt-10 sm:px-6 sm:pb-6 sm:pt-12',
        className,
      )}
    >
      <DemoBadge className="absolute right-3 top-3 sm:right-4 sm:top-4" />
      {children}
    </div>
  )
}

// ─── UiFrame ─────────────────────────────────────────────────────────────────

/** Rám okna aplikace: lišta s logem a názvem obrazovky, pod ní obsah. */
export function UiFrame({ title, meta, children, className }: {
  title: string
  /** drobný text vpravo v liště, např. role přihlášeného */
  meta?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('overflow-hidden rounded-[var(--mk-radius)] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] shadow-[var(--mk-shadow)]', className)}>
      <div className="flex items-center gap-2 border-b border-[var(--mk-line)] bg-[var(--mk-bg)] px-3 py-2">
        <LeafMark className="h-4 w-4 shrink-0" />
        <span className="truncate text-[12px] font-semibold text-[var(--mk-ink)]">{title}</span>
        {meta && <span className="ml-auto hidden truncate text-[11px] text-[var(--mk-muted)] sm:block">{meta}</span>}
      </div>
      {children}
    </div>
  )
}

export function LeafMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <path d="M20 4C14 4 9 9.5 9 16c0 4 1.5 7.5 4 10l7 10 7-10c2.5-2.5 4-6 4-10 0-6.5-5-12-11-12z" fill="var(--mk-green)" />
      <path d="M20 10C20 10 15 14 15 18c0 2.5 2.5 4 5 4 0 0 0-6 0-12z" fill="var(--mk-surface)" opacity=".8" />
      <path d="M20 10c0 0 5 4 5 8 0 2.5-2.5 4-5 4 0 0 0-6 0-12z" fill="var(--mk-surface)" opacity=".5" />
    </svg>
  )
}

// ─── PhoneFrame ──────────────────────────────────────────────────────────────

/** CSS telefon na výšku. Obsah dostává plochu displeje včetně stavového řádku. */
export function PhoneFrame({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('mx-auto w-full max-w-[272px] rounded-[40px] border border-[var(--mk-phone-edge)] bg-[var(--mk-phone)] p-[9px] shadow-[var(--mk-shadow)]', className)}>
      <div className="relative flex aspect-[9/18.5] flex-col overflow-hidden rounded-[32px] bg-[var(--mk-surface)]">
        <div className="flex h-7 shrink-0 items-center justify-between px-6 text-[10.5px] font-semibold text-[var(--mk-ink)]">
          <span>9:41</span>
          <span className="absolute left-1/2 top-[7px] h-[16px] w-[72px] -translate-x-1/2 rounded-full bg-[var(--mk-phone)]" />
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="h-[7px] w-[12px] rounded-[2px] border border-current" />
          </span>
        </div>
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </div>
    </div>
  )
}

// ─── Section, SectionHeading ─────────────────────────────────────────────────

export function Section({ id, tone = 'light', children, className, labelledBy }: {
  id?: string
  tone?: 'light' | 'muted' | 'dark'
  children: React.ReactNode
  className?: string
  labelledBy?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={labelledBy}
      className={cn(
        'mk-section scroll-mt-20',
        tone === 'muted' && 'border-y border-[var(--mk-line)] bg-[var(--mk-surface-2)]',
        tone === 'dark' && 'mk-dark',
        className,
      )}
    >
      <div className="mk-container">{children}</div>
    </section>
  )
}

export function SectionHeading({ id, eyebrow, title, lead, align = 'left', as: Tag = 'h2', className }: {
  id?: string
  eyebrow?: string
  title: React.ReactNode
  lead?: React.ReactNode
  align?: 'left' | 'center'
  as?: 'h1' | 'h2' | 'h3'
  className?: string
}) {
  return (
    <div className={cn('max-w-[720px]', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <p className="mk-doc mb-3 text-[12px] font-medium uppercase tracking-[0.08em] text-[var(--mk-green-ink)]">{eyebrow}</p>
      )}
      <Tag id={id} className="mk-display text-[clamp(28px,4.2vw,44px)] font-semibold leading-[1.1] text-[var(--mk-ink)]">
        {title}
      </Tag>
      {lead && <p className="mt-4 text-[17px] leading-relaxed text-[var(--mk-muted)]">{lead}</p>}
    </div>
  )
}
