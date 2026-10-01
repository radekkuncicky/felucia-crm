'use client'

// Hlavička homepage: sticky, po odscrollování dostane pozadí. Na mobilu menu
// v panelu pod lištou, tlačítko ukázky zůstává viditelné.

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/cn'
import { LeafMark } from '../primitives'
import { NAV } from './content'

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <header
      ref={ref}
      className={cn(
        'sticky top-0 z-40 border-b transition-colors',
        scrolled || open ? 'border-[var(--mk-line)] bg-[var(--mk-bg)]' : 'border-transparent bg-transparent',
      )}
    >
      <div className="mk-container flex h-16 items-center gap-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 rounded-md" aria-label="Felucia - úvod">
          <LeafMark className="h-7 w-7" />
          <span className="mk-display text-[20px] font-bold text-[var(--mk-ink)]">felucia</span>
        </Link>

        <nav aria-label="Hlavní navigace" className="ml-6 hidden lg:block">
          <ul className="flex items-center gap-1">
            {NAV.map(n => (
              <li key={n.href}>
                <a href={n.href} className="rounded-md px-2.5 py-2 text-[14px] font-medium text-[var(--mk-muted)] hover:text-[var(--mk-ink)]">
                  {n.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Link href="/auth/signin" className="hidden rounded-lg px-3 py-2 text-[14px] font-medium text-[var(--mk-ink)] hover:bg-[var(--mk-surface-2)] lg:inline-flex">
            Přihlásit se
          </Link>
          <a
            href="#ukazka"
            onClick={() => setOpen(false)}
            className="inline-flex items-center rounded-lg bg-[var(--mk-green-ink)] px-3.5 py-2 text-[14px] font-semibold text-white hover:bg-[var(--mk-ink)]"
          >
            <span className="sm:hidden">Ukázka</span>
            <span className="hidden sm:inline">Domluvit ukázku</span>
          </a>
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            aria-expanded={open}
            aria-controls="mk-mobile-menu"
            aria-label={open ? 'Zavřít menu' : 'Otevřít menu'}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--mk-line-strong)] text-[var(--mk-ink)] lg:hidden"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" aria-hidden="true">
              {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      <div id="mk-mobile-menu" hidden={!open} className="border-t border-[var(--mk-line)] bg-[var(--mk-bg)] lg:hidden">
        <nav aria-label="Mobilní navigace" className="mk-container py-3">
          <ul className="grid grid-cols-1 gap-1">
            {NAV.map(n => (
              <li key={n.href}>
                <a href={n.href} onClick={() => setOpen(false)} className="block rounded-lg px-3 py-3 text-[16px] font-medium text-[var(--mk-ink)] hover:bg-[var(--mk-surface-2)]">
                  {n.label}
                </a>
              </li>
            ))}
            <li className="mt-1 border-t border-[var(--mk-line)] pt-2">
              <Link href="/auth/signin" className="block rounded-lg px-3 py-3 text-[16px] font-medium text-[var(--mk-green-ink)]">
                Přihlásit se
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </header>
  )
}
