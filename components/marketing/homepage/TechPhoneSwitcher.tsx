'use client'

// Přepínač obrazovek Felucia Tech v sekci #technici. Renderuje se jen aktivní
// obrazovka (TechObrazovka), ostatní se dotáhnou po přepnutí.

import { useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { TechObrazovka, type TechObrazovkaId } from './TechObrazovka'

export function TechPhoneSwitcher({ obrazovky }: { obrazovky: { id: TechObrazovkaId; nazev: string }[] }) {
  const [aktivni, setAktivni] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  function onKey(e: React.KeyboardEvent, i: number) {
    let j = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % obrazovky.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + obrazovky.length) % obrazovky.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = obrazovky.length - 1
    if (j < 0) return
    e.preventDefault()
    setAktivni(j)
    tabs.current[j]?.focus()
  }

  return (
    <div>
      <div role="tablist" aria-label="Obrazovky aplikace Felucia Tech" className="mb-4 flex flex-wrap justify-center gap-1.5">
        {obrazovky.map((o, i) => (
          <button
            key={o.id}
            ref={el => { tabs.current[i] = el }}
            id={`tech-tab-${o.id}`}
            type="button"
            role="tab"
            aria-selected={i === aktivni}
            aria-controls={`tech-panel-${o.id}`}
            tabIndex={i === aktivni ? 0 : -1}
            onClick={() => setAktivni(i)}
            onKeyDown={e => onKey(e, i)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-[13px] font-semibold transition-colors',
              i === aktivni
                ? 'border-[var(--mk-green-ink)] bg-[var(--mk-green-ink)] text-white'
                : 'border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-muted)] hover:text-[var(--mk-ink)]',
            )}
          >
            {o.nazev}
          </button>
        ))}
      </div>
      {obrazovky.map((o, i) => (
        <div key={o.id} id={`tech-panel-${o.id}`} role="tabpanel" aria-labelledby={`tech-tab-${o.id}`} hidden={i !== aktivni}>
          {i === aktivni && <TechObrazovka id={o.id} />}
        </div>
      ))}
    </div>
  )
}
