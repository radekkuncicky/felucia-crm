'use client'

// Průvodce #jak-to-funguje: šest záložek (role="tablist", šipky, Home, End).
// Desktop záložky vlevo, ukázka vpravo; mobil pilulky s vodorovným posunem
// ve vlastním kontejneru. Odkazy #krok-<id> (sekce "Kde utíkají peníze")
// záložku rovnou vyberou. Všechny panely jsou v HTML (skryté), kvůli SEO.

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import type { KrokId } from './content'

export interface PruvodceKrok {
  id: KrokId
  cislo: number
  nazev: string
  kdo: string
  body: string[]
  pozn?: string
  dal: string
  ukazka: React.ReactNode
}

export function Pruvodce({ kroky }: { kroky: PruvodceKrok[] }) {
  const [aktivni, setAktivni] = useState(0)
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const zHashe = () => {
      const m = window.location.hash.match(/^#krok-(\w+)$/)
      if (!m) return
      const i = kroky.findIndex(k => k.id === m[1])
      if (i >= 0) setAktivni(i)
    }
    zHashe()
    window.addEventListener('hashchange', zHashe)
    return () => window.removeEventListener('hashchange', zHashe)
  }, [kroky])

  // Aktivní pilulka na mobilu vždy viditelná (posun jen uvnitř kontejneru)
  useEffect(() => {
    const el = tabs.current[aktivni]
    const box = el?.parentElement
    if (!el || !box || box.scrollWidth <= box.clientWidth) return
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' })
  }, [aktivni])

  function onKey(e: React.KeyboardEvent, i: number) {
    let j = -1
    if (e.key === 'ArrowDown' || e.key === 'ArrowRight') j = (i + 1) % kroky.length
    else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') j = (i - 1 + kroky.length) % kroky.length
    else if (e.key === 'Home') j = 0
    else if (e.key === 'End') j = kroky.length - 1
    if (j < 0) return
    e.preventDefault()
    setAktivni(j)
    tabs.current[j]?.focus()
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[232px_minmax(0,1fr)] lg:gap-10">
      <div
        role="tablist"
        aria-label="Kroky zakázky"
        className="mk-scroll-x -mx-[var(--mk-gutter)] flex gap-2 px-[var(--mk-gutter)] pb-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0"
      >
        {kroky.map((k, i) => {
          const vybrany = i === aktivni
          return (
            <button
              key={k.id}
              ref={el => { tabs.current[i] = el }}
              id={`krok-${k.id}`}
              type="button"
              role="tab"
              aria-selected={vybrany}
              aria-controls={`krok-panel-${k.id}`}
              tabIndex={vybrany ? 0 : -1}
              onClick={() => setAktivni(i)}
              onKeyDown={e => onKey(e, i)}
              className={cn(
                'flex shrink-0 scroll-mt-24 items-center gap-2.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-left text-[14px] font-semibold transition-colors lg:rounded-[var(--mk-radius-sm)] lg:px-3 lg:py-3',
                vybrany
                  ? 'border-[var(--mk-green-ink)] bg-[var(--mk-green-ink)] text-white lg:bg-[var(--mk-surface)] lg:text-[var(--mk-ink)] lg:shadow-[var(--mk-shadow)]'
                  : 'border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-muted)] hover:text-[var(--mk-ink)] lg:border-transparent lg:bg-transparent',
              )}
            >
              <span
                className={cn(
                  'mk-doc hidden h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] lg:flex',
                  vybrany ? 'bg-[var(--mk-green-ink)] text-white' : 'bg-[var(--mk-surface-2)] text-[var(--mk-muted)]',
                )}
              >
                {k.cislo}
              </span>
              {k.nazev}
            </button>
          )
        })}
      </div>

      {kroky.map((k, i) => (
        <div
          key={k.id}
          id={`krok-panel-${k.id}`}
          role="tabpanel"
          aria-labelledby={`krok-${k.id}`}
          hidden={i !== aktivni}
          tabIndex={0}
          className="min-w-0 rounded-[var(--mk-radius)]"
        >
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] xl:gap-8">
            <div>
              <p className="mk-doc text-[12px] uppercase tracking-[0.08em] text-[var(--mk-green-ink)]">Krok {k.cislo} z {kroky.length}</p>
              <h3 className="mk-display mt-2 text-[26px] font-semibold leading-tight">{k.nazev}</h3>
              <p className="mt-2 text-[14px] text-[var(--mk-muted)]">
                <span className="font-semibold text-[var(--mk-ink)]">Kdo pracuje:</span> {k.kdo}
              </p>
              <ul className="mt-5 space-y-3">
                {k.body.map(b => (
                  <li key={b} className="flex gap-3 text-[15.5px] leading-relaxed">
                    <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--mk-green)]" aria-hidden="true" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              {k.pozn && <p className="mt-4 text-[13.5px] leading-relaxed text-[var(--mk-muted)]">{k.pozn}</p>}
              <p className="mt-6 border-t border-dashed border-[var(--mk-line-strong)] pt-4 text-[14.5px]">
                <span className="mk-doc text-[12px] uppercase tracking-[0.06em] text-[var(--mk-green-ink)]">Přechází dál:</span>{' '}
                {k.dal}
              </p>
            </div>
            <div className="min-w-0">{k.ukazka}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
