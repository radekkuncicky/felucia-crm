'use client'

// D1 mobil: sbalená hlavička detailu zakázky. Pod `sm` je vidět jen identifikace,
// souhrn (termín · stav) a řádek rychlých akcí; zbytek (termín/technici/místo/kontakt,
// pipeline, etapy, finance) se rozbalí přes „Detail zakázky". Od `sm` výš je vše
// vidět jako dřív — sbalitelné části jsou tam `display: contents` / `block`.

import { createContext, useContext, useState } from 'react'
import Link from 'next/link'
import { getMapsUrl } from '@/lib/maps'
import { buttonClasses } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

const RozbalenoCtx = createContext<{ open: boolean; toggle: () => void }>({ open: false, toggle: () => {} })

export function SbalitelnyDetail({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return <RozbalenoCtx.Provider value={{ open, toggle: () => setOpen(o => !o) }}>{children}</RozbalenoCtx.Provider>
}

/**
 * Část, která je na mobilu sbalená. `contents` = na desktopu nevytváří vlastní box
 * (děti zůstanou položkami okolního gridu), jinak běžný blok.
 */
export function SbalitelnaCast({ desktop = 'block', className, openClassName, children }: {
  desktop?: 'block' | 'contents'
  /** třídy vždy (mimo display) */
  className?: string
  /** display třídy pro rozbalený stav na mobilu (např. grid) */
  openClassName?: string
  children: React.ReactNode
}) {
  const { open } = useContext(RozbalenoCtx)
  return (
    <div className={cn(className, open ? openClassName : 'hidden', desktop === 'contents' ? 'sm:contents' : 'sm:block')}>
      {children}
    </div>
  )
}

export function SbalitPrepinac() {
  const { open, toggle } = useContext(RozbalenoCtx)
  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={open}
      className="sm:hidden w-full flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-gray-600 dark:text-slate-300 border-t border-gray-100 dark:border-slate-700"
    >
      {open ? 'Skrýt detail' : 'Detail zakázky'}
      <svg className={cn('w-4 h-4 transition-transform', open && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  )
}

const IKONY = {
  navigovat: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  volat: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  foto: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9zM15 13a3 3 0 11-6 0 3 3 0 016 0z',
  protokol: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
}

function Akce({ ikona, label, href, external }: { ikona: keyof typeof IKONY; label: string; href: string; external?: boolean }) {
  const obsah = (
    <>
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={IKONY[ikona]} />
      </svg>
      <span className="text-xs">{label}</span>
    </>
  )
  const cls = buttonClasses({ variant: 'secondary', size: 'md', className: 'flex-1 min-w-0 flex-col !gap-0.5 !px-1 !py-1.5 h-auto' })
  return external
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={cls}>{obsah}</a>
    : href.startsWith('tel:')
      ? <a href={href} className={cls}>{obsah}</a>
      : <Link href={href} className={cls}>{obsah}</Link>
}

/** Řádek rychlých akcí technika v terénu — jen na mobilu */
export function RychleAkce({ zakazkaId, adresa, telefon }: { zakazkaId: string; adresa: string; telefon: string | null }) {
  return (
    <div className="sm:hidden flex gap-2">
      {adresa && <Akce ikona="navigovat" label="Navigovat" href={getMapsUrl(adresa, false)} external />}
      {telefon && <Akce ikona="volat" label="Volat" href={`tel:${telefon}`} />}
      <Akce ikona="foto" label="Foto" href={`/zakazky/${zakazkaId}?tab=podklady#foto`} />
      <Akce ikona="protokol" label="Protokol" href={`/zakazky/${zakazkaId}?tab=protokoly#predavaky`} />
    </div>
  )
}
