import { cn } from '@/lib/cn'
import { DEMO_DASA } from '../demoData'
import { MockFigure } from '../primitives'
import { formatDasaDostupnost } from '@/lib/dasaLimits'

/**
 * Statická konverzace s Dášou - jen akce, které dnes umí (OP, klienti, nabídky,
 * aktivity, stav OP; lib/dasaTools.ts). Bez automatického přehrávání.
 * Vlastní .mk-dark, takže vypadá stejně v tmavé sekci i mimo ni.
 */
export function DasaChatMock({ className, limity = true }: { className?: string; limity?: boolean }) {
  const popis = DEMO_DASA.map(m => `${m.kdo === 'dasa' ? 'Dáša' : 'Uživatel'}: ${m.text}`).join(' ')
  return (
    <div className={cn('mk-dark rounded-[var(--mk-radius)]', className)}>
      <MockFigure label={`Ukázka konverzace s AI asistentkou Dášou. ${popis}`}>
        <div className="overflow-hidden rounded-[var(--mk-radius)] border border-[var(--mk-line)] bg-[var(--mk-surface)]">
          <div className="flex items-center gap-2 border-b border-[var(--mk-line)] px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[var(--mk-green)]" />
            <span className="text-[12.5px] font-semibold text-[var(--mk-ink)]">Dáša</span>
            <span className="text-[12px] text-[var(--mk-muted)]">AI asistentka</span>
          </div>
          <div className="flex flex-col gap-3 p-4">
            {DEMO_DASA.map((m, i) => (
              <div
                key={i}
                className={cn(
                  'max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed',
                  m.kdo === 'uzivatel'
                    ? 'self-end rounded-br-md bg-[var(--mk-green-tint)] text-[var(--mk-ink)]'
                    : 'self-start rounded-bl-md border border-[var(--mk-line)] bg-[var(--mk-surface-2)] text-[var(--mk-ink)]',
                  i >= 4 && 'hidden sm:block',
                )}
              >
                {m.text}
              </div>
            ))}
          </div>
        </div>
      </MockFigure>
      {limity && <p className="mt-3 px-1 text-[13px] text-[var(--mk-muted)]">{formatDasaDostupnost()}.</p>}
    </div>
  )
}
