'use client'

// "Živá zakázka" pro hero: jedna karta prochází stavy řady 101, pod ní lišta šesti fází.
// Autoplay ~2,5 s na stav; pauza při najetí myší, fokusu, skryté záložce nebo tlačítkem.
// Lišta fází = tablist (šipky, Home, End). Při prefers-reduced-motion statická
// "kompletní zakázka" se všemi štítky, bez autoplay.

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { DEMO_DOKLADY, DEMO_KLIENT, DEMO_LIDE, DEMO_MATERIAL, DEMO_TECH, DEMO_TERMIN, DEMO_ZARIZENI, kc, soucetNabidky } from './demoData'
import { DemoBadge, DocChip, type DocKind } from './primitives'
import { IconCheck, IconPause, IconPlay } from './icons'

const STEP_MS = 2500
const END_HOLD_MS = 4000

type FazeId = 'obchod' | 'smlouva' | 'priprava' | 'montaz' | 'predani' | 'servis'

const FAZE: { id: FazeId; nazev: string }[] = [
  { id: 'obchod', nazev: 'Obchod' },
  { id: 'smlouva', nazev: 'Smlouva' },
  { id: 'priprava', nazev: 'Příprava' },
  { id: 'montaz', nazev: 'Montáž' },
  { id: 'predani', nazev: 'Předání' },
  { id: 'servis', nazev: 'Servis' },
]

interface Krok {
  faze: FazeId
  /** doklad, který v tomto kroku vzniká (štítek v řetězu) */
  doc?: { kind: DocKind; cislo: string; prefix?: string }
  titulek: string
  detail: string
}

const KROKY: Krok[] = [
  { faze: 'obchod', doc: { kind: 'poptavka', cislo: 'poptávka' }, titulek: 'Poptávka z webu', detail: `${DEMO_KLIENT.jmeno}, tepelné čerpadlo do rodinného domu` },
  { faze: 'obchod', doc: { kind: 'op', cislo: DEMO_DOKLADY.op }, titulek: 'Obchodní případ', detail: 'Údaje klientky převzaté z poptávky' },
  { faze: 'obchod', doc: { kind: 'nabidka', cislo: DEMO_DOKLADY.nabidka }, titulek: 'Nabídka', detail: `TČ 9 kW, ${kc(soucetNabidky())} bez DPH` },
  { faze: 'smlouva', doc: { kind: 'sod', cislo: DEMO_DOKLADY.sod }, titulek: 'Smlouva podepsána', detail: '2 podpisy, ověřeno SMS kódem' },
  { faze: 'priprava', doc: { kind: 'zakazka', cislo: DEMO_DOKLADY.zakazka, prefix: 'zakázka' }, titulek: 'Zakázka založena', detail: `Montáž ${DEMO_TERMIN.montazKratce}, technik ${DEMO_LIDE.technik.jmeno}` },
  { faze: 'priprava', titulek: 'Materiál vydán', detail: `${DEMO_MATERIAL.length}/${DEMO_MATERIAL.length} položek připraveno` },
  { faze: 'montaz', titulek: 'Technik na místě', detail: `${DEMO_TECH.fotky.length} fotek, položky odškrtnuté` },
  { faze: 'predani', doc: { kind: 'protokol', cislo: DEMO_DOKLADY.protokol }, titulek: 'Předávací protokol', detail: 'Potrubí 10 m -> 12 m, podpis klientky' },
  { faze: 'predani', doc: { kind: 'vyuctovani', cislo: DEMO_DOKLADY.vyuctovani }, titulek: 'Vyúčtování schváleno', detail: '12 m potrubí vyúčtováno' },
  { faze: 'servis', doc: { kind: 'servis', cislo: DEMO_DOKLADY.servis }, titulek: 'Servisní prohlídka naplánována', detail: `Plánovaný servis, ${DEMO_TERMIN.dalsiProhlidka}` },
]

/** Index "kompletní zakázka" (za posledním krokem). */
const KOMPLET = KROKY.length

function prvniKrokFaze(id: FazeId): number {
  return KROKY.findIndex(k => k.faze === id)
}

export function LiveZakazkaHero({ className }: { className?: string }) {
  const [krok, setKrok] = useState(0)
  const [reduced, setReduced] = useState(false)
  const [rucnePauza, setRucnePauza] = useState(false)
  const [hover, setHover] = useState(false)
  const [fokus, setFokus] = useState(false)
  const [skryto, setSkryto] = useState(false)
  /** hlásit změny čtečce jen po akci uživatele, ne při autoplay */
  const [ohlasit, setOhlasit] = useState(false)
  const [beh, setBeh] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const apply = () => {
      setReduced(mq.matches)
      if (mq.matches) setKrok(KOMPLET)
    }
    apply()
    mq.addEventListener('change', apply)
    const vis = () => setSkryto(document.visibilityState === 'hidden')
    document.addEventListener('visibilitychange', vis)
    return () => {
      mq.removeEventListener('change', apply)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [])

  const hraje = !reduced && !rucnePauza && !hover && !fokus && !skryto

  // Po obnovení přehrávání začne průběh aktuálního kroku znovu (stejně jako časovač)
  useEffect(() => {
    if (hraje) setBeh(b => b + 1)
  }, [hraje])

  useEffect(() => {
    if (!hraje) return
    const naKonci = krok >= KROKY.length - 1
    const t = window.setTimeout(() => setKrok(k => (k >= KROKY.length - 1 ? 0 : k + 1)), naKonci ? END_HOLD_MS : STEP_MS)
    return () => window.clearTimeout(t)
  }, [hraje, krok, beh])

  const komplet = krok >= KOMPLET
  const aktualni = komplet ? null : KROKY[krok]
  const aktivniFaze = aktualni ? FAZE.findIndex(f => f.id === aktualni.faze) : FAZE.length - 1

  const vyberFazi = useCallback((i: number, fokusovat = false) => {
    setKrok(prvniKrokFaze(FAZE[i].id))
    setRucnePauza(true)
    setOhlasit(true)
    if (fokusovat) tabRefs.current[i]?.focus()
  }, [])

  function onTabKey(e: React.KeyboardEvent, i: number) {
    let dalsi = -1
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') dalsi = (i + 1) % FAZE.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') dalsi = (i - 1 + FAZE.length) % FAZE.length
    else if (e.key === 'Home') dalsi = 0
    else if (e.key === 'End') dalsi = FAZE.length - 1
    if (dalsi < 0) return
    e.preventDefault()
    vyberFazi(dalsi, true)
  }

  // Štítky řetězu: každý doklad jednou, stav podle aktuálního kroku
  const retez = KROKY.map((k, i) => ({ k, i })).filter(x => x.k.doc)

  return (
    <div
      className={cn('w-full', className)}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setFokus(true)}
      onBlur={e => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFokus(false) }}
    >
      <div
        id="mk-live-zakazka"
        role="tabpanel"
        aria-labelledby={`mk-live-faze-${aktivniFaze}`}
        className="mk-grid relative overflow-hidden rounded-[var(--mk-radius)] border border-[var(--mk-line)] p-3 sm:p-5"
      >
        <div className="rounded-[var(--mk-radius)] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] shadow-[var(--mk-shadow)]">
          <div className="flex items-center gap-2 border-b border-[var(--mk-line)] px-4 py-2.5">
            <span className="shrink-0 text-[13px] font-semibold">{DEMO_KLIENT.jmeno}</span>
            <span className="hidden min-w-0 truncate text-[12px] text-[var(--mk-muted)] sm:inline">{DEMO_KLIENT.mesto} - {DEMO_ZARIZENI}</span>
            <DemoBadge className="ml-auto shrink-0" />
          </div>

          <div className="min-h-[148px] px-4 pb-3 pt-4 sm:min-h-[156px] sm:px-5" aria-live={ohlasit ? 'polite' : 'off'} aria-atomic="true">
            {aktualni ? (
              <div key={krok} className="mk-enter">
                <p className="mk-doc text-[11.5px] uppercase tracking-[0.08em] text-[var(--mk-green-ink)]">
                  Fáze {aktivniFaze + 1} z {FAZE.length} - {FAZE[aktivniFaze].nazev}
                </p>
                <div className="mt-2 flex min-h-[30px] flex-wrap items-center gap-2">
                  {aktualni.doc && (
                    <DocChip kind={aktualni.doc.kind} prefix={aktualni.doc.prefix} state="current">{aktualni.doc.cislo}</DocChip>
                  )}
                  <span className="mk-display text-[20px] font-semibold leading-tight sm:text-[22px]">{aktualni.titulek}</span>
                </div>
                <p className="mt-1.5 text-[14.5px] text-[var(--mk-muted)]">{aktualni.detail}</p>
              </div>
            ) : (
              <div>
                <p className="mk-doc text-[11.5px] uppercase tracking-[0.08em] text-[var(--mk-green-ink)]">Kompletní zakázka</p>
                <p className="mk-display mt-2 text-[20px] font-semibold leading-tight sm:text-[22px]">Od poptávky po servis v jednom záznamu</p>
                <p className="mt-1.5 text-[14.5px] text-[var(--mk-muted)]">Každý doklad navazuje na předchozí. Nic se nepřepisuje.</p>
              </div>
            )}
          </div>

          <div className="h-[3px] bg-[var(--mk-line)]" aria-hidden="true">
            {hraje && aktualni && (
              <div
                key={`${krok}-${beh}`}
                className="mk-progress h-full bg-[var(--mk-green)]"
                style={{ ['--mk-step-ms' as string]: `${krok >= KROKY.length - 1 ? END_HOLD_MS : STEP_MS}ms` }}
              />
            )}
          </div>

          <ol className="flex flex-wrap gap-1.5 px-4 py-3 sm:px-5" aria-label="Doklady zakázky">
            {retez.map(({ k, i }) => {
              const stav = komplet || i < krok ? 'done' : i === krok ? 'current' : 'todo'
              return (
                <li key={k.doc!.cislo} className="flex items-center gap-1.5">
                  <DocChip kind={k.doc!.kind} size="sm" state={stav}>{k.doc!.cislo}</DocChip>
                </li>
              )
            })}
          </ol>
        </div>
      </div>

      <div className="mt-3 flex items-stretch gap-2">
        <div role="tablist" aria-label="Fáze zakázky" className="grid flex-1 grid-cols-3 gap-1 sm:grid-cols-6">
          {FAZE.map((f, i) => {
            const vybrana = i === aktivniFaze && !komplet
            const hotova = komplet || i < aktivniFaze
            return (
              <button
                key={f.id}
                ref={el => { tabRefs.current[i] = el }}
                id={`mk-live-faze-${i}`}
                type="button"
                role="tab"
                aria-selected={vybrana}
                aria-controls="mk-live-zakazka"
                tabIndex={i === aktivniFaze ? 0 : -1}
                onClick={() => vyberFazi(i)}
                onKeyDown={e => onTabKey(e, i)}
                className={cn(
                  'flex items-center justify-center gap-1 rounded-lg border px-1.5 py-2 text-[12.5px] font-semibold transition-colors',
                  vybrana
                    ? 'border-[var(--mk-green-ink)] bg-[var(--mk-green-ink)] text-white'
                    : hotova
                      ? 'border-[var(--mk-green-line)] bg-[var(--mk-green-tint)] text-[var(--mk-green-ink)]'
                      : 'border-[var(--mk-line)] bg-[var(--mk-surface)] text-[var(--mk-muted)] hover:border-[var(--mk-line-strong)]',
                )}
              >
                {hotova && !vybrana && <IconCheck className="h-3.5 w-3.5" />}
                {f.nazev}
              </button>
            )
          })}
        </div>
        {!reduced && (
          <button
            type="button"
            onClick={() => {
              setOhlasit(true)
              if (rucnePauza) {
                // Výslovné "přehrát" má přednost před pauzou z najetí myší / fokusu
                setRucnePauza(false)
                setHover(false)
                setFokus(false)
              } else {
                setRucnePauza(true)
              }
            }}
            aria-label={rucnePauza ? 'Spustit ukázku' : 'Pozastavit ukázku'}
            className="flex w-11 shrink-0 items-center justify-center rounded-lg border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] text-[var(--mk-ink)] hover:bg-[var(--mk-surface-2)]"
          >
            {rucnePauza ? <IconPlay className="h-4 w-4" /> : <IconPause className="h-4 w-4" />}
          </button>
        )}
      </div>
    </div>
  )
}
