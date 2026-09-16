'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

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
}

interface Props {
  events: CalendarEvent[]
  canDispatch?: boolean  // ADMIN/MANAGER can see capacity view
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

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + n)
  return toDateStr(d)
}

/** Všechny dny, na které událost připadá (od–do včetně; max. 366 dní jako pojistka). */
function eventDays(ev: CalendarEvent): string[] {
  if (!ev.dateTo || ev.dateTo <= ev.date) return [ev.date]
  const days: string[] = []
  let d = ev.date
  while (d <= ev.dateTo && days.length < 366) {
    days.push(d)
    d = addDays(d, 1)
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

function EventChip({ ev, day, compact = false }: { ev: CalendarEvent; day?: string; compact?: boolean }) {
  const s = KIND_STYLE[ev.kind]
  const pos = day ? rangePos(ev, day) : 'single'
  const statusIcon = ev.done ? '✓' : ev.zruseno ? '✕' : null
  const title = isRange(ev) ? `${ev.title} (${fmtRange(ev)})` : ev.title
  return (
    <Link
      href={ev.href}
      onClick={e => e.stopPropagation()}
      title={title}
      className={`flex items-center gap-1.5 px-2 py-1 text-xs leading-snug hover:opacity-80 transition-opacity ${
        ev.zruseno ? 'bg-gray-100 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500 line-through' : `${s.bg} ${s.text}`
      } ${ev.done ? 'opacity-60' : ''} ${RANGE_SHAPE[pos]}`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${ev.zruseno ? 'bg-gray-400' : s.dot}`} />
      {statusIcon && <span className="flex-shrink-0 font-bold">{statusIcon}</span>}
      {ev.time && !compact && <span className="flex-shrink-0 font-semibold opacity-80">{ev.time}</span>}
      {(pos === 'middle' || pos === 'end') && <span className="flex-shrink-0 opacity-60">…</span>}
      <span className="truncate font-medium">{ev.title}</span>
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

function MonthView({ year, month, events, selectedDate, onSelectDate, todayStr }: {
  year: number
  month: number
  events: CalendarEvent[]
  selectedDate: string | null
  onSelectDate: (d: string) => void
  todayStr: string
}) {
  const cells = getMonthCells(year, month)
  const byDate = useMemo(() => indexByDate(events), [events])

  return (
    <div className="flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
        {DAYS_CS.map((d, i) => (
          <div key={d} className={`text-center text-sm font-semibold py-2.5 ${i >= 5 ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(124px, 1fr))` }}>
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
            <div
              key={ds}
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
                {visibleEvents.map(ev => <EventChip key={ev.id} ev={ev} day={ds} />)}
                {hiddenCount > 0 && (
                  <div className="text-xs font-medium text-gray-500 dark:text-slate-400 hover:text-gray-800 dark:hover:text-slate-200 pl-2 py-0.5">
                    +{hiddenCount} {hiddenCount < 5 ? 'další' : 'dalších'}
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Week view ───────────────────────────────────────────────────────────────

function WeekView({ pivot, events, onSelectDate, todayStr }: {
  pivot: Date
  events: CalendarEvent[]
  onSelectDate: (d: string) => void
  todayStr: string
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
            <div
              key={ds}
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
            </div>
          )
        })}

        {/* Event cells */}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          const dayEvents = byDate[ds] ?? []
          const isWeekend = i >= 5
          return (
            <div
              key={`events-${ds}`}
              onClick={() => onSelectDate(ds)}
              className={`border-r border-gray-100 dark:border-slate-700 p-2 min-h-[280px] cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-700/20 ${isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''}`}
            >
              <div className="space-y-1">
                {dayEvents.map(ev => <EventChip key={ev.id} ev={ev} day={ds} />)}
                {dayEvents.length === 0 && (
                  <p className="text-xs text-gray-300 dark:text-slate-600 text-center mt-6">–</p>
                )}
              </div>
            </div>
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

function KapacitaView({ pivot, events, todayStr }: {
  pivot: Date
  events: CalendarEvent[]
  todayStr: string
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

  if (technici.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-gray-500 dark:text-slate-400 font-medium">Žádné naplánované montáže tento týden</p>
          <p className="text-sm text-gray-400 dark:text-slate-500 mt-1">Nastavte termín montáže v detailu zakázky</p>
        </div>
      </div>
    )
  }

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
                <th key={ds} className={`text-center px-2 py-3 border-b border-r border-gray-100 dark:border-slate-700 ${isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                  <div className={`text-sm font-semibold mb-1 ${isWeekend ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>
                    {DAYS_CS[i]}
                  </div>
                  <div className={`text-base font-bold w-9 h-9 flex items-center justify-center rounded-full mx-auto ${
                    isToday ? 'bg-[#4CAF50] text-white' : isWeekend ? 'text-red-400' : 'text-gray-800 dark:text-slate-200'
                  }`}>
                    {d.getDate()}
                  </div>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
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

export default function CalendarClient({ events, canDispatch = false }: Props) {
  const today = new Date()
  const todayStr = toDateStr(today)

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
    if (view === 'month') return `${MONTHS_CS[month]} ${year}`
    if (view === 'week' || view === 'kapacita') {
      const days = getWeekDays(pivot)
      const first = days[0], last = days[6]
      if (first.getMonth() === last.getMonth())
        return `${first.getDate()}. – ${last.getDate()}. ${MONTHS_CS[first.getMonth()]} ${first.getFullYear()}`
      return `${first.getDate()}. ${MONTHS_CS[first.getMonth()]} – ${last.getDate()}. ${MONTHS_CS[last.getMonth()]} ${last.getFullYear()}`
    }
    return fmtDate(toDateStr(pivot))
  }, [view, month, year, pivot])

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
      <div className="flex flex-col lg:flex-row gap-3 flex-1">
        {/* Main calendar */}
        <div className="flex-1 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden flex flex-col">
          {view === 'month' && (
            <MonthView
              year={year} month={month} events={events}
              selectedDate={selectedDate} onSelectDate={handleSelectDate} todayStr={todayStr}
            />
          )}
          {view === 'week' && (
            <WeekView
              pivot={pivot} events={events}
              onSelectDate={handleSelectDate} todayStr={todayStr}
            />
          )}
          {view === 'day' && (
            <DayView date={dayDate} events={events.filter(e => occursOn(e, dayDate))} />
          )}
          {view === 'kapacita' && (
            <KapacitaView pivot={pivot} events={events} todayStr={todayStr} />
          )}
        </div>

        {/* Side panel: selected day details (month + week views) */}
        {view !== 'day' && selectedDate && (
          <div className="lg:w-96 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-3">
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
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3 px-1">
        {(Object.entries(KIND_STYLE) as [CalendarEvent['kind'], typeof KIND_STYLE[CalendarEvent['kind']]][]).map(([kind, s]) => (
          <div key={kind} className="flex items-center gap-2">
            <span className={`w-2.5 h-2.5 rounded-full ${s.dot}`} />
            <span className="text-sm text-gray-600 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
