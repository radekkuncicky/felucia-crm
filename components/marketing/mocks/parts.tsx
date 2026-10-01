// Sdílené kousky kódovaných ukázek (jen vizuál - ukázky jsou uvnitř role="img").

import { cn } from '@/lib/cn'
import { IconArrowRight, IconCheck } from '../icons'

/** Popisek + hodnota jako v detailu aplikace. */
export function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="text-[11px] font-medium uppercase tracking-[0.05em] text-[var(--mk-faint)]">{label}</div>
      <div className="mt-0.5 truncate text-[14px] font-medium text-[var(--mk-ink)]">{children}</div>
    </div>
  )
}

/** Imitace tlačítka aplikace (span - ukázka není interaktivní). */
export function FakeButton({ children, variant = 'secondary', className }: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary'
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-[12.5px] font-semibold',
        variant === 'primary'
          ? 'bg-[var(--mk-green-ink)] text-white'
          : 'border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[var(--mk-ink)]',
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Stavová lišta: hotové kroky s fajfkou, aktuální zvýrazněný, budoucí šedé.
 * compact = na mobilu jen tečky a popisek aktuálního stavu.
 */
export function StateTrack({ steps, current, compact = 'mobile', className }: {
  steps: readonly string[]
  current: number
  compact?: 'mobile' | 'never'
  className?: string
}) {
  return (
    <div className={className}>
      <ol className={cn('items-center gap-1', compact === 'mobile' ? 'hidden sm:flex' : 'flex flex-wrap')}>
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-1">
            <span
              className={cn(
                'inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11.5px] font-medium',
                i < current && 'border-[var(--mk-green-line)] bg-[var(--mk-green-tint)] text-[var(--mk-green-ink)]',
                i === current && 'border-[var(--mk-green-ink)] bg-[var(--mk-green-ink)] text-white',
                i > current && 'border-[var(--mk-line)] bg-transparent text-[var(--mk-faint)]',
              )}
            >
              {i < current && <IconCheck className="h-3 w-3" />}
              {s}
            </span>
            {i < steps.length - 1 && <span className={cn('h-px w-2.5', i < current ? 'bg-[var(--mk-green)]' : 'bg-[var(--mk-line-strong)]')} />}
          </li>
        ))}
      </ol>
      {compact === 'mobile' && (
        <div className="flex items-center gap-2 sm:hidden">
          <span className="flex gap-1">
            {steps.map((s, i) => (
              <span
                key={s}
                className={cn('h-1.5 rounded-full', i === current ? 'w-5 bg-[var(--mk-green)]' : 'w-1.5', i < current ? 'bg-[var(--mk-green-line)]' : i > current ? 'bg-[var(--mk-line-strong)]' : '')}
              />
            ))}
          </span>
          <span className="text-[12px] font-semibold text-[var(--mk-green-ink)]">{steps[current]}</span>
          <span className="text-[11px] text-[var(--mk-faint)]">{current + 1}/{steps.length}</span>
        </div>
      )}
    </div>
  )
}

/** Navazující stavy dvou dokladů za sebou: "Podepsán -> Schválen -> VYU Návrh -> ..." */
export function FlowArrow({ className }: { className?: string }) {
  return <IconArrowRight className={cn('h-3.5 w-3.5 shrink-0 text-[var(--mk-faint)]', className)} />
}

/** Popiska mimo rám ukázky - jako kóta na výkresu. */
export function Callout({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <p className={cn('mt-3 flex items-start gap-2 text-[13px] leading-snug text-[var(--mk-muted)]', className)}>
      <span className="mt-[5px] h-2 w-2 shrink-0 rounded-full border-2 border-[var(--mk-green)]" />
      <span>{children}</span>
    </p>
  )
}

/** Tah podpisu (SVG) - stejný v SOD, protokolu i telefonu. */
export function SignatureScribble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 160 48" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 34c8-14 14-24 18-22s-6 26-2 26 12-24 18-22-4 18 2 18 10-16 16-14-2 12 4 12 8-8 14-10 6 6 12 4 10-6 16-6 12 2 20 0"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
