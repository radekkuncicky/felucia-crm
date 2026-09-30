'use client'

import { useState, useMemo, useEffect, ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { api } from '@/lib/api'
import { techColors } from '@/lib/constants'
import { TECH_SHORT, TECHNOLOGIE_LABEL, diffDays, shiftRange } from '@/lib/calendarEvents'

export interface CalendarEvent {
  id: string
  kind: 'HOVOR' | 'EMAIL' | 'SCHUZKA' | 'UKOL' | 'POZNAMKA' | 'REALIZACE' | 'PREVZETI' | 'ZALOHA' | 'SERVIS'
  date: string   // YYYY-MM-DD (začátek)
  dateTo?: string // YYYY-MM-DD (konec, jen u vícedenních akcí – včetně)
  time?: string  // HH:MM
  trvaniMin?: number
  title: string
  short?: string // zkrácený název pro úzké buňky (kapacitní pohled)
  subtitle: string
  href: string
  done?: boolean
  zruseno?: boolean
  technici?: string[]  // for kapacita view
  kdykoliv?: boolean   // zakázka „Kdykoliv" — termín je flexibilní, dá se přesunout
  klient?: string      // jméno klienta / název firmy — hlavní text chipu
  tech?: string        // Technologie (enum) — barevný štítek jako v tabulce zakázek
  move?: { zakazkaId: string; etapaId?: string }  // montáž, kterou lze přetažením přeplánovat
}

/** Zakázka s příznakem „Kdykoliv" bez termínu — kandidát na výplň volného dne */
export interface KdykolivZakazka {
  id: string
  cislo: string
  nazev: string
  klient: string
  technologie: string
  technici: string[]
  href: string
}

interface Props {
  events: CalendarEvent[]
  canDispatch?: boolean  // ADMIN/MANAGER can see capacity view
  kdykolivPool?: KdykolivZakazka[]  // jen s canDispatch; přetažením na den se naplánuje
}

type ViewMode = 'month' | 'week' | 'day' | 'kapacita'

const MONTHS_CS = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']
const DAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const DAYS_FULL_CS = ['Pondělí', 'Úterý', 'Středa', 'Čtvrtek', 'Pátek', 'Sobota', 'Neděle']
const MONTH_MAX_CHIPS = 3

const KIND_STYLE: Record<CalendarEvent['kind'], { dot: string; bg: string; text: string; label: string }> = {
  HOVOR:    { dot: 'bg-blue-500',   bg: 'bg-blue-100 dark:bg-blue-900/40',   text: 'text-blue-700 dark:text-blue-300',   label: 'Hovor' },
  EMAIL:    { dot: 'bg-teal-500',   bg: 'bg-teal-100 dark:bg-teal-900/40',   text: 'text-teal-700 dark:text-teal-300',   label: 'Email' },
  SCHUZKA:  { dot: 'bg-purple-500', bg: 'bg-purple-100 dark:bg-purple-900/40', text: 'text-purple-700 dark:text-purple-300', label: 'Schůzka' },
  UKOL:     { dot: 'bg-orange-500', bg: 'bg-orange-100 dark:bg-orange-900/40', text: 'text-orange-700 dark:text-orange-300', label: 'Úkol' },
  POZNAMKA: { dot: 'bg-slate-400',  bg: 'bg-slate-100 dark:bg-slate-700',    text: 'text-slate-600 dark:text-slate-300', label: 'Poznámka' },
  REALIZACE:{ dot: 'bg-red-500',    bg: 'bg-red-100 dark:bg-red-900/40',     text: 'text-red-700 dark:text-red-300',     label: 'Realizace' },
  PREVZETI: { dot: 'bg-rose-400',   bg: 'bg-rose-100 dark:bg-rose-900/40',   text: 'text-rose-700 dark:text-rose-300',  label: 'Převzetí' },
  ZALOHA:   { dot: 'bg-amber-500',  bg: 'bg-amber-100 dark:bg-amber-900/40', text: 'text-amber-700 dark:text-amber-300', label: 'Záloha' },
  SERVIS:   { dot: 'bg-green-500',  bg: 'bg-green-100 dark:bg-green-900/40', text: 'text-green-700 dark:text-green-300', label: 'Servis' },
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function fmtDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-')
  return `${parseInt(d)}. ${parseInt(m)}. ${y}`
}

function fmtTrvani(min: number): string {
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  const m = min % 60
  return m > 0 ? `${h} h ${m} min` : `${h} hod`
}

function getMonthCells(year: number, month: number): Array<Date | null> {
  const firstDay = new Date(year, month, 1).getDay()
  const offset = firstDay === 0 ? 6 : firstDay - 1
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: Array<Date | null> = Array(offset).fill(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function getWeekDays(pivot: Date): Date[] {
  const day = pivot.getDay()
  const offset = day === 0 ? 6 : day - 1
  const monday = new Date(pivot)
  monday.setDate(pivot.getDate() - offset)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// ─── Vícedenní události (od–do) ──────────────────────────────────────────────

/** Všechny dny, na které událost připadá (od–do včetně; max. 366 dní jako pojistka). */
function eventDays(ev: CalendarEvent): string[] {
  if (!ev.dateTo || ev.dateTo <= ev.date) return [ev.date]
  const days: string[] = []
  let d = ev.date
  while (d <= ev.dateTo && days.length < 366) {
    days.push(d)
    d = shiftRange(d, undefined, 1).date
  }
  return days
}

function occursOn(ev: CalendarEvent, ds: string): boolean {
  if (!ev.dateTo) return ev.date === ds
  return ev.date <= ds && ds <= ev.dateTo
}

function isRange(ev: CalendarEvent): boolean {
  return !!ev.dateTo && ev.dateTo > ev.date
}

type RangePos = 'single' | 'start' | 'middle' | 'end'

function rangePos(ev: CalendarEvent, ds: string): RangePos {
  if (!isRange(ev)) return 'single'
  if (ds === ev.date) return 'start'
  if (ds === ev.dateTo) return 'end'
  return 'middle'
}

/** den → události (vícedenní rozepsané na každý den; vícedenní řazeny první, aby pruhy lícovaly) */
function indexByDate(events: CalendarEvent[]): Record<string, CalendarEvent[]> {
  const m: Record<string, CalendarEvent[]> = {}
  const sorted = [...events].sort((a, b) => {
    const ra = isRange(a) ? 0 : 1, rb = isRange(b) ? 0 : 1
    if (ra !== rb) return ra - rb
    if (a.date !== b.date) return a.date.localeCompare(b.date)
    return (a.time ?? '').localeCompare(b.time ?? '')
  })
  for (const e of sorted) {
    for (const ds of eventDays(e)) {
      if (!m[ds]) m[ds] = []
      m[ds].push(e)
    }
  }
  return m
}

function fmtRange(ev: CalendarEvent): string {
  return ev.dateTo && ev.dateTo > ev.date ? `${fmtDate(ev.date)} – ${fmtDate(ev.dateTo)}` : fmtDate(ev.date)
}

const RANGE_SHAPE: Record<RangePos, string> = {
  single: 'rounded-md',
  start:  'rounded-l-md rounded-r-none -mr-2',
  middle: 'rounded-none -mx-2',
  end:    'rounded-r-md rounded-l-none -ml-2',
}

/** Štítek „Kdykoliv" u naplánované zakázky — flexibilní termín, dá se přesunout */
function KdykolivTag() {
  return (
    <span title="Kdykoliv — flexibilní termín, dá se přesunout"
      className="inline-flex items-center flex-shrink-0 px-1 rounded text-[9px] font-bold uppercase leading-4 bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 mr-1">
      Kdykoliv
    </span>
  )
}

/** Čas posledního dokončeného přetažení — klik, který tah ukončí, nemá otevírat odkaz */
let lastDragEndAt = 0
function suppressClickAfterDrag(e: { preventDefault: () => void }) {
  if (Date.now() - lastDragEndAt < 400) e.preventDefault()
}

/** Štítek technologie — stejné barvy jako v tabulce zakázek (lib/constants techColors) */
function TechPill({ tech, full = false }: { tech: string; full?: boolean }) {
  const color = techColors[tech as keyof typeof techColors] ?? techColors.JINE
  return (
    <span className={`inline-flex items-center flex-shrink-0 px-1.5 rounded-full text-[10px] font-semibold leading-4 ring-1 ring-inset ring-black/5 ${color}`}>
      {full ? (TECHNOLOGIE_LABEL[tech] ?? tech) : (TECH_SHORT[tech] ?? tech)}
    </span>
  )
}

function EventChip({ ev, day, compact = false, draggable = false, overlay = false }: {
  ev: CalendarEvent
  day?: string
  compact?: boolean
  draggable?: boolean  // montáž, kterou může dispečer přetáhnout na jiný den
  overlay?: boolean    // kopie chipu v DragOverlay
}) {
  const s = KIND_STYLE[ev.kind]
  const pos = day && !overlay ? rangePos(ev, day) : 'single'
  const statusIcon = ev.done ? '✓' : ev.zruseno ? '✕' : null
  const title = isRange(ev) ? `${ev.title} (${fmtRange(ev)})` : ev.title
  const canDrag = draggable && !!ev.move && !!day && !overlay
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `ev:${ev.id}:${day ?? ''}`,
    disabled: !canDrag,
  })
  return (
    <Link
      ref={canDrag ? setNodeRef : undefined}
      {...(canDrag ? { ...listeners, ...attributes } : {})}
      href={ev.href}
      onClick={e => { e.stopPropagation(); suppressClickAfterDrag(e) }}
      title={canDrag ? `${title}\nPřetažením přesunete termín montáže` : title}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs leading-snug hover:opacity-80 transition-opacity ${
        ev.zruseno ? 'bg-gray-100 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500 line-through' : `${s.bg} ${s.text}`
      } ${ev.done ? 'opacity-60' : ''} ${RANGE_SHAPE[pos]} ${canDrag ? 'cursor-grab active:cursor-grabbing touch-none' : ''} ${
        isDragging ? 'opacity-40' : ''} ${overlay ? 'shadow-2xl ring-2 ring-amber-400 cursor-grabbing' : ''}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.zruseno ? 'bg-gray-400' : s.dot}`} />
      {ev.kdykoliv && <KdykolivTag />}
      {statusIcon && <span className="flex-shrink-0 font-bold">{statusIcon}</span>}
      {ev.time && !compact && <span className="flex-shrink-0 font-semibold opacity-80">{ev.time}</span>}
      {(pos === 'middle' || pos === 'end') && <span className="flex-shrink-0 opacity-60">…</span>}
      <span className="truncate font-semibold min-w-0">{ev.klient || ev.title}</span>
      {ev.klient && ev.tech && <TechPill tech={ev.tech} />}
      {pos === 'start' && <span className="flex-shrink-0 opacity-60">…</span>}
    </Link>
  )
}

function EventCard({ ev }: { ev: CalendarEvent }) {
  const s = KIND_STYLE[ev.kind]
  const isDone = ev.done
  const isZruseno = ev.zruseno
  return (
    <Link
      href={ev.href}
      className={`flex items-start gap-3 p-4 rounded-lg ${isZruseno ? 'bg-gray-100 dark:bg-slate-700/30' : s.bg} ${isDone ? 'opacity-70' : ''} hover:opacity-80 transition-opacity`}
    >
      <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-2 ${isZruseno ? 'bg-gray-400' : s.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className={`text-base font-semibold ${isZruseno ? 'text-gray-400 dark:text-slate-500 line-through' : s.text}`}>{ev.title}</p>
          {ev.kdykoliv && <KdykolivTag />}
          {ev.tech && <TechPill tech={ev.tech} full />}
          {isDone && <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-0.5 rounded">✓ Hotovo</span>}
          {isZruseno && <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-2 py-0.5 rounded">✕ Zrušeno</span>}
        </div>
        {ev.subtitle && <p className="text-sm text-gray-600 dark:text-slate-400 truncate mt-0.5">{ev.subtitle}</p>}
        <div className="flex items-center gap-2.5 mt-1 flex-wrap">
          <span className={`text-sm font-medium ${isZruseno ? 'text-gray-400' : s.text} opacity-70`}>{s.label}</span>
          {isRange(ev) && (
            <span className="text-sm text-gray-500 dark:text-slate-400">{fmtRange(ev)}</span>
          )}
          {ev.time && (
            <span className="text-sm text-gray-500 dark:text-slate-400">
              {ev.time}{ev.trvaniMin ? ` · ${fmtTrvani(ev.trvaniMin)}` : ''}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

// ─── Month view ──────────────────────────────────────────────────────────────

/** Pohled Měsíc = dva měsíce pod sebou (aktuální + následující), hlavička dnů jednou nahoře */
function MonthsView({ year, month, events, selectedDate, onSelectDate, todayStr, dragEnabled }: {
  year: number
  month: number
  events: CalendarEvent[]
  selectedDate: string | null
  onSelectDate: (d: string) => void
  todayStr: string
  dragEnabled: boolean
}) {
  const byDate = useMemo(() => indexByDate(events), [events])
  const next = month === 11 ? { year: year + 1, month: 0 } : { year, month: month + 1 }

  return (
    <div className="flex-1">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700 sticky top-0 z-20 bg-white dark:bg-slate-800">
        {DAYS_CS.map((d, i) => (
          <div key={d} className={`text-center text-sm font-semibold py-2.5 ${i >= 5 ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>
      {[{ year, month }, next].map(m => (
        <MonthGrid
          key={`${m.year}-${m.month}`}
          year={m.year} month={m.month} byDate={byDate}
          selectedDate={selectedDate} onSelectDate={onSelectDate} todayStr={todayStr}
          dragEnabled={dragEnabled}
        />
      ))}
    </div>
  )
}

function MonthGrid({ year, month, byDate, selectedDate, onSelectDate, todayStr, dragEnabled }: {
  year: number
  month: number
  byDate: Record<string, CalendarEvent[]>
  selectedDate: string | null
  onSelectDate: (d: string) => void
  todayStr: string
  dragEnabled: boolean
}) {
  const cells = getMonthCells(year, month)

  return (
    <div>
      <div className="px-4 py-2 text-sm font-bold text-gray-800 dark:text-slate-200 bg-gray-50 dark:bg-slate-800/60 border-b border-gray-100 dark:border-slate-700">
        {MONTHS_CS[month]} {year}
      </div>
      <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(110px, auto))` }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="border-b border-r border-gray-50 dark:border-slate-700/50 bg-gray-50/30 dark:bg-slate-800/30" />
          const ds = toDateStr(day)
          const dayEvents = byDate[ds] ?? []
          const isToday = ds === todayStr
          const isSelected = ds === selectedDate
          const colIdx = i % 7
          const isWeekend = colIdx === 5 || colIdx === 6
          const visibleEvents = dayEvents.length > MONTH_MAX_CHIPS ? dayEvents.slice(0, MONTH_MAX_CHIPS - 1) : dayEvents
          const hiddenCount = dayEvents.length - visibleEvents.length

          return (
            <DroppableDay
              key={ds}
              dayStr={ds}
              enabled={dragEnabled}
              onClick={() => onSelectDate(ds)}
              className={`border-b border-r border-gray-100 dark:border-slate-700/50 p-2 cursor-pointer transition-colors overflow-hidden ${
                isSelected ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <div className="flex justify-end mb-1.5">
                <span className={`text-sm font-medium w-8 h-8 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-[#4CAF50] text-white font-bold' : isWeekend ? 'text-red-400' : 'text-gray-700 dark:text-slate-300'
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-1">
                {visibleEvents.map(ev => <EventChip key={ev.id} ev={ev} day={ds} draggable={dragEnabled} />)}
                {hiddenCount > 0 && (
                  <div className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 pl-2 py-0.5">
                    +{hiddenCount} {hiddenCount < 5 ? 'další' : 'dalších'}
                  </div>
                )}
              </div>
            </DroppableDay>
          )
        })}
      </div>
    </div>
  )
}

// ─── Drag & drop: pool „Kdykoliv" → den ──────────────────────────────────────

/** Cíl přetažení = den. S `enabled=false` je jen obyčejný div (měsíc/den view, bez oprávnění). */
function DroppableDay({ dayStr, enabled, className, onClick, children }: {
  dayStr: string
  enabled: boolean
  className: string
  onClick?: () => void
  children: ReactNode
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `day:${dayStr}`, disabled: !enabled })
  return (
    <div
      ref={setNodeRef}
      data-day={dayStr}
      onClick={onClick}
      className={`${className} ${isOver ? 'ring-2 ring-inset ring-amber-400 bg-amber-50/70 dark:bg-amber-900/20' : ''}`}
    >
      {children}
    </div>
  )
}

function KdykolivCard({ z, overlay = false }: { z: KdykolivZakazka; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: `pool:${z.id}` })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined

  const inner = (
    <div className={`flex gap-2 rounded-lg border bg-white dark:bg-slate-800 p-2 select-none border-amber-200 dark:border-amber-800
      ${isDragging ? 'opacity-40' : ''}
      ${overlay ? 'shadow-2xl rotate-1 scale-105' : 'hover:border-amber-400 hover:shadow-sm transition-all'}`}
    >
      <div className="w-1 rounded-full flex-shrink-0 bg-amber-400" />
      <div className="min-w-0 flex-1">
        <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">{z.cislo}</span>
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{z.klient}</p>
        <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{z.technologie || z.nazev}</p>
        {z.technici.length > 0 && (
          <p className="text-[10px] text-gray-400 dark:text-slate-500 truncate mt-0.5">{z.technici.join(', ')}</p>
        )}
      </div>
    </div>
  )

  if (overlay) return inner

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      <Link href={z.href} onClick={e => { if (transform) e.preventDefault(); suppressClickAfterDrag(e) }}>
        {inner}
      </Link>
    </div>
  )
}

function KdykolivPool({ items }: { items: KdykolivZakazka[] }) {
  return (
    <div className="lg:w-72 lg:self-start lg:sticky lg:top-4 bg-white dark:bg-slate-800 rounded-xl border border-amber-200 dark:border-amber-800/60 p-3 flex flex-col gap-2">
      <div>
        <h3 className="font-bold text-gray-900 dark:text-white text-sm flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          Kdykoliv ({items.length})
        </h3>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-0.5">Přetáhněte na den v kalendáři — nastaví se termín montáže.</p>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-slate-500 py-2">
          Žádné nezaplánované zakázky „Kdykoliv“. Označte zakázku přepínačem <b>Kdykoliv</b> v její hlavičce a objeví se tady.
        </p>
      ) : (
        <div className="space-y-1.5 overflow-y-auto max-h-[70vh]">
          {items.map(z => <KdykolivCard key={z.id} z={z} />)}
        </div>
      )}
    </div>
  )
}

// ─── Week view ───────────────────────────────────────────────────────────────

function WeekView({ pivot, events, onSelectDate, todayStr, dropEnabled = false }: {
  pivot: Date
  events: CalendarEvent[]
  onSelectDate: (d: string) => void
  todayStr: string
  dropEnabled?: boolean
}) {
  const days = getWeekDays(pivot)
  const byDate = useMemo(() => indexByDate(events), [events])

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 min-w-[700px]">
        {/* Headers */}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          const isToday = ds === todayStr
          const isWeekend = i >= 5
          return (
            <DroppableDay
              key={ds}
              dayStr={ds}
              enabled={dropEnabled}
              onClick={() => onSelectDate(ds)}
              className={`border-b border-r border-gray-100 dark:border-slate-700 px-2 py-3 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 ${isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : ''}`}
            >
              <div className={`text-sm font-semibold mb-1 ${isWeekend ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                {DAYS_CS[i]}
              </div>
              <div className={`text-base font-bold w-9 h-9 flex items-center justify-center rounded-full mx-auto ${
                isToday ? 'bg-[#4CAF50] text-white' : isWeekend ? 'text-red-400' : 'text-gray-800 dark:text-slate-200'
              }`}>
                {d.getDate()}
              </div>
            </DroppableDay>
          )
        })}

        {/* Event cells */}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          const dayEvents = byDate[ds] ?? []
          const isWeekend = i >= 5
          return (
            <DroppableDay
              key={`events-${ds}`}
              dayStr={`${ds}:cell`}
              enabled={dropEnabled}
              onClick={() => onSelectDate(ds)}
              className={`border-r border-gray-100 dark:border-slate-700 p-2 min-h-[280px] cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-700/20 ${isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''}`}
            >
              <div className="space-y-1">
                {dayEvents.map(ev => <EventChip key={ev.id} ev={ev} day={ds} draggable={dropEnabled} />)}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-gray-300 dark:text-slate-600 text-center mt-6">–</p>
                )}
              </div>
            </DroppableDay>
          )
        })}
      </div>
    </div>
  )
}

// ─── Day view ────────────────────────────────────────────────────────────────

function DayView({ date, events }: { date: string; events: CalendarEvent[] }) {
  const dayEvents = useMemo(
    () => [...events].sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
    [events]
  )
  const [y, m, d] = date.split('-')
  const weekdayIdx = new Date(date + 'T12:00:00').getDay()
  const dow = weekdayIdx === 0 ? 6 : weekdayIdx - 1

  return (
    <div className="flex-1 overflow-auto p-5">
      <div className="mb-5">
        <p className="text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">{DAYS_FULL_CS[dow]}</p>
        <p className="text-3xl font-bold text-gray-900 dark:text-white">{parseInt(d)}. {parseInt(m)}. {y}</p>
      </div>
      {dayEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-base">Žádné události</div>
      ) : (
        <div className="space-y-3 max-w-2xl">
          {dayEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}
        </div>
      )}
    </div>
  )
}

// ─── Kapacita view ───────────────────────────────────────────────────────────

function KapacitaView({ pivot, events, todayStr, dropEnabled = false }: {
  pivot: Date
  events: CalendarEvent[]
  todayStr: string
  dropEnabled?: boolean
}) {
  const days = getWeekDays(pivot)

  // Gather only montáž events (have technici array)
  const montazEvents = useMemo(() => events.filter(e => e.technici && e.technici.length > 0), [events])

  // Collect unique technician names
  const technici = useMemo(() => {
    const set = new Set<string>()
    for (const e of montazEvents) e.technici!.forEach(t => set.add(t))
    return Array.from(set).sort()
  }, [montazEvents])

  // Map: date → technik → events
  const matrix = useMemo(() => {
    const m: Record<string, Record<string, CalendarEvent[]>> = {}
    for (const e of montazEvents) {
      for (const ds of eventDays(e)) {
        if (!m[ds]) m[ds] = {}
        for (const t of e.technici!) {
          if (!m[ds][t]) m[ds][t] = []
          m[ds][t].push(e)
        }
      }
    }
    return m
  }, [montazEvents])

  // Prázdný týden: hlavička dnů zůstává (je cílem přetažení z poolu „Kdykoliv"),
  // text jde do jediného řádku tabulky.
  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-sm font-semibold text-gray-500 dark:text-slate-400 uppercase px-4 py-3 bg-gray-50 dark:bg-slate-800/50 border-b border-r border-gray-100 dark:border-slate-700 w-44 sticky left-0 z-10">
              Technik
            </th>
            {days.map((d, i) => {
              const ds = toDateStr(d)
              const isToday = ds === todayStr
              const isWeekend = i >= 5
              return (
                <th key={ds} className={`text-center p-0 border-b border-r border-gray-100 dark:border-slate-700 ${isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                  <DroppableDay dayStr={ds} enabled={dropEnabled} className="px-2 py-3">
                    <div className={`text-sm font-semibold mb-1 ${isWeekend ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                      {DAYS_CS[i]}
                    </div>
                    <div className={`text-base font-bold w-9 h-9 flex items-center justify-center rounded-full mx-auto ${
                      isToday ? 'bg-[#4CAF50] text-white' : isWeekend ? 'text-red-400' : 'text-gray-800 dark:text-slate-200'
                    }`}>
                      {d.getDate()}
                    </div>
                  </DroppableDay>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {technici.length === 0 && (
            <tr>
              <td colSpan={8} className="p-8 text-center">
                <p className="text-gray-500 dark:text-slate-400 font-medium">Žádné naplánované montáže tento týden</p>
                <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">
                  {dropEnabled ? 'Přetáhněte zakázku z poolu „Kdykoliv" na den, nebo nastavte termín v detailu zakázky' : 'Nastavte termín montáže v detailu zakázky'}
                </p>
              </td>
            </tr>
          )}
          {technici.map(technik => (
            <tr key={technik} className="border-b border-gray-100 dark:border-slate-700">
              <td className="px-4 py-3 font-medium text-gray-700 dark:text-slate-300 text-sm border-r border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky left-0 z-10">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 text-sm font-bold flex-shrink-0">
                    {technik.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[110px] text-base">{technik.split(' ')[0]}</span>
                </div>
              </td>
              {days.map((d, i) => {
                const ds = toDateStr(d)
                const cellEvents = matrix[ds]?.[technik] ?? []
                const isWeekend = i >= 5
                return (
                  <td key={ds} className={`px-2 py-2 border-r border-gray-100 dark:border-slate-700 align-top min-w-[120px] ${
                    isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''
                  }`}>
                    {cellEvents.length === 0 ? (
                      <div className="text-xs text-gray-300 dark:text-slate-700 text-center py-3">–</div>
                    ) : (
                      <div className="space-y-1">
                        {cellEvents.map(ev => (
                          <Link
                            key={ev.id}
                            href={ev.href}
                            className="block px-2 py-1.5 rounded-md text-xs leading-snug bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:opacity-80 transition-opacity"
                            title={isRange(ev) ? `${ev.title} (${fmtRange(ev)})` : ev.title}
                          >
                            {ev.kdykoliv && <KdykolivTag />}
                            {ev.time && <span className="font-semibold">{ev.time} </span>}
                            <span className="truncate font-medium">{ev.short ?? ev.title}</span>
                          </Link>
                        ))}
                      </div>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Main ────────────────────────────────────────────────────────────────────

export default function CalendarClient({ events: serverEvents, canDispatch = false, kdykolivPool = [] }: Props) {
  const router = useRouter()
  const today = new Date()
  const todayStr = toDateStr(today)

  // Pool „Kdykoliv" — lokální kopie kvůli optimistickému odebrání po dropu;
  // po router.refresh() přijdou z props aktuální data.
  const [pool, setPool] = useState(kdykolivPool)
  useEffect(() => setPool(kdykolivPool), [kdykolivPool])
  // Události — lokální kopie kvůli optimistickému posunu montáže po přetažení
  const [events, setEvents] = useState(serverEvents)
  useEffect(() => setEvents(serverEvents), [serverEvents])
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const [view, setView] = useState<ViewMode>('month')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [pivot, setPivot] = useState(today)
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  function prevPeriod() {
    if (view === 'month') {
      if (month === 0) { setYear(y => y - 1); setMonth(11) }
      else setMonth(m => m - 1)
    } else if (view === 'week' || view === 'kapacita') {
      const d = new Date(pivot); d.setDate(d.getDate() - 7); setPivot(d)
    } else {
      const d = new Date(pivot); d.setDate(d.getDate() - 1); setPivot(d)
      setSelectedDate(toDateStr(d))
    }
  }

  function nextPeriod() {
    if (view === 'month') {
      if (month === 11) { setYear(y => y + 1); setMonth(0) }
      else setMonth(m => m + 1)
    } else if (view === 'week' || view === 'kapacita') {
      const d = new Date(pivot); d.setDate(d.getDate() + 7); setPivot(d)
    } else {
      const d = new Date(pivot); d.setDate(d.getDate() + 1); setPivot(d)
      setSelectedDate(toDateStr(d))
    }
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
    setPivot(new Date(today))
    setSelectedDate(todayStr)
  }

  function handleSelectDate(ds: string) {
    setSelectedDate(ds === selectedDate ? null : ds)
    if (view === 'day') {
      const parts = ds.split('-')
      setPivot(new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2])))
    }
  }

  const headerLabel = useMemo(() => {
    if (view === 'month') {
      const nextMonth = (month + 1) % 12
      const nextYear = month === 11 ? year + 1 : year
      return nextYear === year
        ? `${MONTHS_CS[month]} – ${MONTHS_CS[nextMonth]} ${year}`
        : `${MONTHS_CS[month]} ${year} – ${MONTHS_CS[nextMonth]} ${nextYear}`
    }
    if (view === 'week' || view === 'kapacita') {
      const days = getWeekDays(pivot)
      const first = days[0], last = days[6]
      if (first.getMonth() === last.getMonth())
        return `${first.getDate()}. – ${last.getDate()}. ${MONTHS_CS[first.getMonth()]} ${first.getFullYear()}`
      return `${first.getDate()}. ${MONTHS_CS[first.getMonth()]} – ${last.getDate()}. ${MONTHS_CS[last.getMonth()]} ${last.getFullYear()}`
    }
    return fmtDate(toDateStr(pivot))
  }, [view, month, year, pivot])

  const dropEnabled = canDispatch && view !== 'day'
  const showPool = dropEnabled
  const activePoolItem = activeId?.startsWith('pool:') ? pool.find(z => `pool:${z.id}` === activeId) ?? null : null
  const activeEvent = useMemo(() => {
    if (!activeId?.startsWith('ev:')) return null
    const evId = activeId.slice(3, activeId.lastIndexOf(':'))
    return events.find(e => e.id === evId) ?? null
  }, [activeId, events])

  // UTC půlnoc — stejný formát jako MontazDatePicker, aby zakázka padla na správný den
  const utcMidnight = (ds: string) => new Date(ds).toISOString()

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    lastDragEndAt = Date.now()
    const { active, over } = event
    if (!over) return
    const target = String(over.id)
    if (!target.startsWith('day:')) return
    const dayStr = target.slice(4).replace(/:cell$/, '')
    const dragId = String(active.id)

    // Pool „Kdykoliv" → den: nastaví termín montáže
    if (dragId.startsWith('pool:')) {
      const id = dragId.slice(5)
      const prev = pool
      setPool(p => p.filter(z => z.id !== id))
      const res = await api.patch(`/api/zakazky/${id}`, { montazOd: utcMidnight(dayStr), montazDo: utcMidnight(dayStr) },
        { errorMessage: 'Termín se nepodařilo nastavit. Zkuste to prosím znovu.' })
      if (!res.ok) {
        setPool(prev)
        return
      }
      router.refresh()
      return
    }

    // Naplánovaná montáž → jiný den: posun od–do se zachováním délky
    if (dragId.startsWith('ev:')) {
      const sep = dragId.lastIndexOf(':')
      const evId = dragId.slice(3, sep)
      const grabbedDay = dragId.slice(sep + 1)
      const ev = events.find(e => e.id === evId)
      if (!ev?.move || !grabbedDay) return
      const delta = diffDays(grabbedDay, dayStr)
      if (delta === 0) return
      const shifted = shiftRange(ev.date, ev.dateTo, delta)
      const prev = events
      setEvents(list => list.map(e => (e.id === ev.id ? { ...e, ...shifted } : e)))
      const body: Record<string, string> = { montazOd: utcMidnight(shifted.date) }
      if (shifted.dateTo) body.montazDo = utcMidnight(shifted.dateTo)
      // Jednodenní montáž s vyplněným montazDo = montazOd — posunout i konec
      else body.montazDo = utcMidnight(shifted.date)
      const url = ev.move.etapaId
        ? `/api/zakazky/${ev.move.zakazkaId}/etapy/${ev.move.etapaId}`
        : `/api/zakazky/${ev.move.zakazkaId}`
      const res = await api.patch(url, body, { errorMessage: 'Termín montáže se nepodařilo přesunout. Zkuste to prosím znovu.' })
      if (!res.ok) {
        setEvents(prev)
        return
      }
      router.refresh()
    }
  }

  const dayDate = view === 'day' ? toDateStr(pivot) : (selectedDate ?? todayStr)
  const selectedEvents = useMemo(
    () => selectedDate ? events.filter(e => occursOn(e, selectedDate)) : [],
    [events, selectedDate]
  )

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 mb-3">
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
          {/* Nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevPeriod} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-bold text-gray-900 dark:text-white min-w-[220px] text-center text-base">{headerLabel}</span>
            <button onClick={nextPeriod} className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={goToday} className="text-sm font-medium px-3.5 py-2 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors ml-1">
              Dnes
            </button>
          </div>

          {/* View tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            {(['month', 'week', 'day'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-green-600 text-white'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
              >
                {v === 'month' ? 'Měsíc' : v === 'week' ? 'Týden' : 'Den'}
              </button>
            ))}
            {canDispatch && (
              <button
                onClick={() => setView('kapacita')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-l border-gray-200 dark:border-slate-600 ${
                  view === 'kapacita'
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'
                }`}
                title="Kapacitní pohled dispečera"
              >
                Kapacita
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Calendar body */}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
        onDragEnd={handleDragEnd}
      >
      <div className="flex flex-col lg:flex-row gap-3 flex-1" style={{ cursor: activeId ? 'grabbing' : undefined }}>
        {/* Main calendar */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-clip flex flex-col">
          {view === 'month' && (
            <MonthsView
              year={year} month={month} events={events}
              selectedDate={selectedDate} onSelectDate={handleSelectDate} todayStr={todayStr}
              dragEnabled={dropEnabled}
            />
          )}
          {view === 'week' && (
            <WeekView
              pivot={pivot} events={events}
              onSelectDate={handleSelectDate} todayStr={todayStr}
              dropEnabled={dropEnabled}
            />
          )}
          {view === 'day' && (
            <DayView date={dayDate} events={events.filter(e => occursOn(e, dayDate))} />
          )}
          {view === 'kapacita' && (
            <KapacitaView pivot={pivot} events={events} todayStr={todayStr} dropEnabled={dropEnabled} />
          )}
        </div>

        {/* Side panel: selected day details (month + week views) */}
        {view !== 'day' && selectedDate && (
          <div className="lg:w-96 lg:self-start lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 dark:text-white text-base">{fmtDate(selectedDate)}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-1">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-base text-gray-400 dark:text-slate-500">Žádné události</p>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1">
                {selectedEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}
              </div>
            )}
          </div>
        )}

        {/* Pool „Kdykoliv" — nezaplánované výplňové zakázky (týden + kapacita, jen dispečer) */}
        {showPool && <KdykolivPool items={pool} />}
      </div>
      <DragOverlay dropAnimation={null}>
        {activePoolItem ? <KdykolivCard z={activePoolItem} overlay />
          : activeEvent ? <div className="w-48"><EventChip ev={activeEvent} overlay /></div>
          : null}
      </DragOverlay>
      </DndContext>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-1">
        {(Object.entries(KIND_STYLE) as [CalendarEvent['kind'], typeof KIND_STYLE[CalendarEvent['kind']]][]).map(([kind, s]) => (
          <div key={kind} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className="text-sm text-gray-600 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
        {Object.keys(TECH_SHORT).map(t => (
          <div key={t} className="flex items-center gap-2">
            <TechPill tech={t} full />
          </div>
        ))}
        <div className="flex items-center gap-2">
          <KdykolivTag />
          <span className="text-sm text-gray-600 dark:text-slate-400">Flexibilní termín</span>
        </div>
      </div>
    </div>
  )
}
