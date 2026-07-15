'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'

export interface CalendarEvent {
  id: string
  kind: 'HOVOR' | 'EMAIL' | 'SCHUZKA' | 'UKOL' | 'POZNAMKA' | 'REALIZACE' | 'PREVZETI' | 'ZALOHA' | 'SERVIS'
  date: string   // YYYY-MM-DD
  time?: string  // HH:MM
  trvaniMin?: number
  title: string
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

function EventChip({ ev, compact = false }: { ev: CalendarEvent; compact?: boolean }) {
  const s = KIND_STYLE[ev.kind]
  const statusIcon = ev.done ? '✓' : ev.zruseno ? '✕' : null
  return (
    <Link
      href={ev.href}
      onClick={e => e.stopPropagation()}
      className={`flex items-center gap-1 px-1 py-0.5 rounded text-[10px] leading-tight ${ev.zruseno ? 'bg-gray-100 dark:bg-slate-700/50 text-gray-400 dark:text-slate-500 line-through' : s.bg + ' ' + s.text} ${ev.done ? 'opacity-60' : ''} hover:opacity-80 transition-opacity`}
      title={ev.title}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ev.zruseno ? 'bg-gray-400' : s.dot}`} />
      {statusIcon && <span className="flex-shrink-0 font-bold">{statusIcon}</span>}
      {ev.time && !compact && <span className="flex-shrink-0 opacity-75">{ev.time}</span>}
      <span className="truncate">{ev.title}</span>
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
      className={`flex items-start gap-3 p-3 rounded-lg ${isZruseno ? 'bg-gray-100 dark:bg-slate-700/30' : s.bg} ${isDone ? 'opacity-70' : ''} hover:opacity-80 transition-opacity`}
    >
      <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${isZruseno ? 'bg-gray-400' : s.dot}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className={`text-sm font-medium ${isZruseno ? 'text-gray-400 dark:text-slate-500 line-through' : s.text}`}>{ev.title}</p>
          {isDone && <span className="text-xs font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-1.5 py-0.5 rounded">✓ Hotovo</span>}
          {isZruseno && <span className="text-xs font-semibold text-gray-500 dark:text-slate-400 bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">✕ Zrušeno</span>}
        </div>
        {ev.subtitle && <p className="text-xs text-gray-500 dark:text-slate-400 truncate">{ev.subtitle}</p>}
        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
          <span className={`text-xs font-medium ${isZruseno ? 'text-gray-400' : s.text} opacity-70`}>{s.label}</span>
          {ev.time && (
            <span className="text-xs text-gray-500 dark:text-slate-400">
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
  const byDate = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    }
    return m
  }, [events])

  return (
    <div className="flex-1 overflow-hidden">
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-gray-100 dark:border-slate-700">
        {DAYS_CS.map((d, i) => (
          <div key={d} className={`text-center text-xs font-semibold py-2 ${i >= 5 ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
            {d}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: `repeat(${cells.length / 7}, minmax(80px, 1fr))` }}>
        {cells.map((day, i) => {
          if (!day) return <div key={`empty-${i}`} className="border-b border-r border-gray-50 dark:border-slate-700/50 bg-gray-50/30 dark:bg-slate-800/30" />
          const ds = toDateStr(day)
          const dayEvents = byDate[ds] ?? []
          const isToday = ds === todayStr
          const isSelected = ds === selectedDate
          const colIdx = i % 7
          const isWeekend = colIdx === 5 || colIdx === 6

          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              className={`border-b border-r border-gray-100 dark:border-slate-700/50 p-1.5 cursor-pointer transition-colors overflow-hidden ${
                isSelected ? 'bg-green-50 dark:bg-green-950/30' : 'hover:bg-gray-50 dark:hover:bg-slate-700/30'
              }`}
            >
              <div className="flex justify-end mb-1">
                <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-[#4CAF50] text-white font-bold' : isWeekend ? 'text-red-400' : 'text-gray-600 dark:text-slate-400'
                }`}>
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map(ev => <EventChip key={ev.id} ev={ev} />)}
                {dayEvents.length > 3 && (
                  <div className="text-[10px] text-gray-400 dark:text-slate-500 pl-1">+{dayEvents.length - 3} dalších</div>
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
  const byDate = useMemo(() => {
    const m: Record<string, CalendarEvent[]> = {}
    for (const e of events) {
      if (!m[e.date]) m[e.date] = []
      m[e.date].push(e)
    }
    return m
  }, [events])

  return (
    <div className="flex-1 overflow-auto">
      <div className="grid grid-cols-7 min-w-[560px]">
        {/* Headers */}
        {days.map((d, i) => {
          const ds = toDateStr(d)
          const isToday = ds === todayStr
          const isWeekend = i >= 5
          return (
            <div
              key={ds}
              onClick={() => onSelectDate(ds)}
              className={`border-b border-r border-gray-100 dark:border-slate-700 p-2 text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-700/30 ${isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : ''}`}
            >
              <div className={`text-xs font-semibold mb-0.5 ${isWeekend ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
                {DAYS_CS[i]}
              </div>
              <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto ${
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
              className={`border-r border-gray-100 dark:border-slate-700 p-1.5 min-h-[200px] cursor-pointer hover:bg-gray-50/50 dark:hover:bg-slate-700/20 ${isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''}`}
            >
              <div className="space-y-0.5">
                {dayEvents.map(ev => <EventChip key={ev.id} ev={ev} />)}
                {dayEvents.length === 0 && (
                  <p className="text-[10px] text-gray-300 dark:text-slate-600 text-center mt-4">–</p>
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
    <div className="flex-1 overflow-auto p-4">
      <div className="mb-4">
        <p className="text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase">{DAYS_FULL_CS[dow]}</p>
        <p className="text-2xl font-bold text-gray-900 dark:text-white">{parseInt(d)}. {parseInt(m)}. {y}</p>
      </div>
      {dayEvents.length === 0 ? (
        <div className="text-center py-12 text-gray-400 dark:text-slate-500 text-sm">Žádné události</div>
      ) : (
        <div className="space-y-2 max-w-lg">
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
      if (!m[e.date]) m[e.date] = {}
      for (const t of e.technici!) {
        if (!m[e.date][t]) m[e.date][t] = []
        m[e.date][t].push(e)
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
      <table className="w-full min-w-[600px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="text-left text-xs font-semibold text-gray-400 dark:text-slate-500 uppercase px-3 py-2 bg-gray-50 dark:bg-slate-800/50 border-b border-r border-gray-100 dark:border-slate-700 w-32 sticky left-0 z-10">
              Technik
            </th>
            {days.map((d, i) => {
              const ds = toDateStr(d)
              const isToday = ds === todayStr
              const isWeekend = i >= 5
              return (
                <th key={ds} className={`text-center px-2 py-2 border-b border-r border-gray-100 dark:border-slate-700 ${isWeekend ? 'bg-gray-50/50 dark:bg-slate-800/50' : 'bg-gray-50 dark:bg-slate-800/50'}`}>
                  <div className={`text-xs font-semibold mb-0.5 ${isWeekend ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
                    {DAYS_CS[i]}
                  </div>
                  <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full mx-auto ${
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
              <td className="px-3 py-2 font-medium text-gray-700 dark:text-slate-300 text-sm border-r border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800 sticky left-0 z-10">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-300 text-xs font-bold flex-shrink-0">
                    {technik.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate max-w-[80px]">{technik.split(' ')[0]}</span>
                </div>
              </td>
              {days.map((d, i) => {
                const ds = toDateStr(d)
                const cellEvents = matrix[ds]?.[technik] ?? []
                const isWeekend = i >= 5
                return (
                  <td key={ds} className={`px-1.5 py-1.5 border-r border-gray-100 dark:border-slate-700 align-top min-w-[90px] ${
                    isWeekend ? 'bg-gray-50/30 dark:bg-slate-800/30' : ''
                  }`}>
                    {cellEvents.length === 0 ? (
                      <div className="text-[10px] text-gray-300 dark:text-slate-700 text-center py-2">–</div>
                    ) : (
                      <div className="space-y-0.5">
                        {cellEvents.map(ev => (
                          <Link
                            key={ev.id}
                            href={ev.href}
                            className="block px-1.5 py-1 rounded text-[10px] leading-tight bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 hover:opacity-80 transition-opacity"
                            title={ev.title}
                          >
                            {ev.time && <span className="font-semibold">{ev.time} </span>}
                            <span className="truncate">{ev.title.replace('Montáž: ', '')}</span>
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
    () => events.filter(e => e.date === (selectedDate ?? '')),
    [events, selectedDate]
  )

  return (
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 160px)' }}>
      {/* Toolbar */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 mb-3">
        <div className="flex items-center justify-between px-4 py-3 gap-3 flex-wrap">
          {/* Nav */}
          <div className="flex items-center gap-2">
            <button onClick={prevPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-semibold text-gray-900 dark:text-white min-w-[180px] text-center text-sm">{headerLabel}</span>
            <button onClick={nextPeriod} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-slate-700 text-gray-500 dark:text-slate-400 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
            <button onClick={goToday} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-green-400 hover:text-green-600 dark:hover:text-green-400 transition-colors ml-1">
              Dnes
            </button>
          </div>

          {/* View tabs */}
          <div className="flex rounded-lg border border-gray-200 dark:border-slate-600 overflow-hidden">
            {(['month', 'week', 'day'] as ViewMode[]).map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
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
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-l border-gray-200 dark:border-slate-600 ${
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
            <DayView date={dayDate} events={events.filter(e => e.date === dayDate)} />
          )}
          {view === 'kapacita' && (
            <KapacitaView pivot={pivot} events={events} todayStr={todayStr} />
          )}
        </div>

        {/* Side panel: selected day details (month + week views) */}
        {view !== 'day' && selectedDate && (
          <div className="lg:w-72 bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{fmtDate(selectedDate)}</h3>
              <button onClick={() => setSelectedDate(null)} className="text-gray-400 hover:text-gray-600 dark:hover:text-slate-200 p-0.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            {selectedEvents.length === 0 ? (
              <p className="text-sm text-gray-400 dark:text-slate-500">Žádné události</p>
            ) : (
              <div className="space-y-2 overflow-y-auto flex-1">
                {selectedEvents.map(ev => <EventCard key={ev.id} ev={ev} />)}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 mt-3">
        {(Object.entries(KIND_STYLE) as [CalendarEvent['kind'], typeof KIND_STYLE[CalendarEvent['kind']]][]).map(([kind, s]) => (
          <div key={kind} className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${s.dot}`} />
            <span className="text-xs text-gray-500 dark:text-slate-400">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
