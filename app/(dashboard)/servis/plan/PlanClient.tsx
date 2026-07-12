'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  DndContext, DragEndEvent, DragOverEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { stavLabel, stavColor, typLabel, jeProsla } from '@/lib/servisStav'

interface Row {
  id: string
  cislo: string | null
  typ: string
  stav: string
  planovanyTermin: string | null
  technikId: string | null
  klientNazev: string | null
  predmet: string | null
  adresa: string | null
}

interface OrgUser {
  id: string
  jmeno: string
}

interface Props {
  rows: Row[]
  orgUsers: OrgUser[]
}

const DAYS_CS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
const MONTHS_CS = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince']
const MONTHS_NOM = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec']

// Barvy techniků (stejná logika napříč dispečinkem — index do orgUsers).
const TECH_COLORS = [
  { dot: 'bg-blue-500', bar: 'bg-blue-500' },
  { dot: 'bg-purple-500', bar: 'bg-purple-500' },
  { dot: 'bg-orange-500', bar: 'bg-orange-500' },
  { dot: 'bg-pink-500', bar: 'bg-pink-500' },
  { dot: 'bg-teal-500', bar: 'bg-teal-500' },
  { dot: 'bg-amber-500', bar: 'bg-amber-500' },
  { dot: 'bg-indigo-500', bar: 'bg-indigo-500' },
]

function techColor(technikId: string | null, users: OrgUser[]) {
  if (!technikId) return { dot: 'bg-gray-400', bar: 'bg-gray-300 dark:bg-slate-600' }
  const idx = users.findIndex(u => u.id === technikId)
  if (idx < 0) return { dot: 'bg-gray-400', bar: 'bg-gray-300 dark:bg-slate-600' }
  return TECH_COLORS[idx % TECH_COLORS.length]
}

function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Den zakázky v lokálním čase (klíč sloupce).
function dayKey(iso: string | null): string | null {
  if (!iso) return null
  return toDateStr(new Date(iso))
}

function getWeekDays(pivot: Date): Date[] {
  const day = pivot.getDay()
  const offset = day === 0 ? 6 : day - 1
  const monday = new Date(pivot)
  monday.setDate(pivot.getDate() - offset)
  monday.setHours(0, 0, 0, 0)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

// Týdny (Po–Ne) pokrývající celý měsíc pivotu — pro měsíční mřížku.
function getMonthWeeks(pivot: Date): Date[][] {
  const posledni = new Date(pivot.getFullYear(), pivot.getMonth() + 1, 0)
  const weeks: Date[][] = []
  let cur = getWeekDays(new Date(pivot.getFullYear(), pivot.getMonth(), 1))
  while (cur[0] <= posledni) {
    weeks.push(cur)
    const next = new Date(cur[0])
    next.setDate(next.getDate() + 7)
    cur = getWeekDays(next)
  }
  return weeks
}

// Nový termín pro cílový den — zachová čas původního termínu, jinak 9:00.
function buildIso(dayStr: string, fromIso: string | null): string {
  const [y, m, d] = dayStr.split('-').map(Number)
  let hh = 9, mm = 0
  if (fromIso) {
    const dt = new Date(fromIso)
    hh = dt.getHours()
    mm = dt.getMinutes()
  }
  return new Date(y, m - 1, d, hh, mm).toISOString()
}

function fmtTime(iso: string | null): string | null {
  if (!iso) return null
  return new Date(iso).toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })
}

function Card({ row, users, overlay = false, onAssign }: {
  row: Row
  users: OrgUser[]
  overlay?: boolean
  onAssign?: (rowId: string, technikId: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: row.id,
  })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const col = techColor(row.technikId, users)
  const prosla = jeProsla(row.stav, row.planovanyTermin)
  const cas = fmtTime(row.planovanyTermin)

  const inner = (
    <div className={`flex gap-2 rounded-lg border bg-white dark:bg-slate-800 p-2 select-none
      ${prosla ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-slate-700'}
      ${isDragging ? 'opacity-40' : ''}
      ${overlay ? 'shadow-2xl rotate-1 scale-105' : 'hover:border-green-400 dark:hover:border-green-600 hover:shadow-sm transition-all'}`}
    >
      <div className={`w-1 rounded-full flex-shrink-0 ${col.bar}`} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {row.cislo && <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500 flex-shrink-0">{row.cislo}</span>}
          {cas && <span className="text-[10px] font-semibold text-gray-500 dark:text-slate-400 flex-shrink-0">{cas}</span>}
        </div>
        <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{row.klientNazev ?? '—'}</p>
        {row.predmet && <p className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{row.predmet}</p>}
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          <span className={`text-[9px] px-1 py-0.5 rounded-full font-medium ${stavColor(row.stav)}`}>{stavLabel(row.stav)}</span>
          <span className="text-[9px] text-gray-400 dark:text-slate-500">{typLabel(row.typ)}</span>
        </div>
        {!overlay && onAssign && (
          <select
            value={row.technikId ?? ''}
            onChange={e => onAssign(row.id, e.target.value)}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            className="mt-1 w-full text-[10px] border border-gray-200 dark:border-slate-600 rounded px-1 py-0.5 bg-gray-50 dark:bg-slate-700 text-gray-700 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">— nepřiřazen —</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.jmeno}</option>)}
          </select>
        )}
      </div>
    </div>
  )

  if (overlay) return inner

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      <Link href={`/servis/zakazky/${row.id}`} onClick={e => { if (transform) e.preventDefault() }}>
        {inner}
      </Link>
    </div>
  )
}

function DayColumn({ dayStr, label, dayNum, isToday, isPast, isWeekend, rows, users, isOver, onAssign }: {
  dayStr: string
  label: string
  dayNum: number
  isToday: boolean
  isPast: boolean
  isWeekend: boolean
  rows: Row[]
  users: OrgUser[]
  isOver: boolean
  onAssign: (rowId: string, technikId: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: `day:${dayStr}` })
  return (
    <div className="flex flex-col flex-shrink-0 w-[150px]">
      <div className={`rounded-t-lg px-2 py-1.5 border border-b-0 border-gray-200 dark:border-slate-700 ${isWeekend ? 'bg-gray-50 dark:bg-slate-900/50' : 'bg-white dark:bg-slate-800'}`}>
        <div className="flex items-center justify-between">
          <span className={`text-xs font-semibold ${isWeekend ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{label}</span>
          <span className={`text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full ${isToday ? 'bg-green-600 text-white' : isPast ? 'text-gray-300 dark:text-slate-600' : 'text-gray-800 dark:text-slate-200'}`}>{dayNum}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[180px] rounded-b-lg border border-t-0 border-gray-200 dark:border-slate-700 p-1.5 space-y-1.5 overflow-y-auto transition-colors
          ${isOver ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-600' : isWeekend ? 'bg-gray-50/40 dark:bg-slate-900/30' : 'bg-gray-50/40 dark:bg-slate-900/20'}`}
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {rows.length === 0 && (
          <div className={`flex items-center justify-center h-12 rounded border-2 border-dashed text-[10px] transition-colors
            ${isOver ? 'border-green-400 text-green-500' : 'border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600'}`}>
            {isOver ? 'Pustit' : '–'}
          </div>
        )}
        {rows.map(r => <Card key={r.id} row={r} users={users} onAssign={onAssign} />)}
      </div>
    </div>
  )
}

// Kompaktní jednořádková karta pro měsíční mřížku (drag i klik jako Card).
function CardMini({ row, users }: { row: Row; users: OrgUser[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: row.id })
  const style = transform ? { transform: CSS.Translate.toString(transform) } : undefined
  const col = techColor(row.technikId, users)
  const prosla = jeProsla(row.stav, row.planovanyTermin)
  const cas = fmtTime(row.planovanyTermin)

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      <Link href={`/servis/zakazky/${row.id}`} onClick={e => { if (transform) e.preventDefault() }}>
        <div
          title={`${row.cislo ?? ''} ${row.klientNazev ?? ''} — ${stavLabel(row.stav)}${row.predmet ? ` · ${row.predmet}` : ''}`}
          className={`flex items-center gap-1 rounded px-1 py-0.5 border bg-white dark:bg-slate-800 select-none
            ${prosla ? 'border-red-300 dark:border-red-800' : 'border-gray-200 dark:border-slate-700'}
            ${isDragging ? 'opacity-40' : 'hover:border-green-400 dark:hover:border-green-600 transition-colors'}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.dot}`} />
          {cas && <span className="text-[9px] font-semibold text-gray-500 dark:text-slate-400 flex-shrink-0">{cas}</span>}
          <span className="text-[10px] text-gray-900 dark:text-white truncate">{row.klientNazev ?? row.cislo ?? '—'}</span>
        </div>
      </Link>
    </div>
  )
}

function MonthDayCell({ dayStr, dayNum, isToday, isCurrentMonth, isWeekend, rows, users, isOver }: {
  dayStr: string
  dayNum: number
  isToday: boolean
  isCurrentMonth: boolean
  isWeekend: boolean
  rows: Row[]
  users: OrgUser[]
  isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: `day:${dayStr}` })
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[96px] rounded-lg border p-1 space-y-0.5 transition-colors
        ${isOver ? 'bg-green-50 dark:bg-green-950/20 border-green-300 dark:border-green-600'
          : isCurrentMonth
            ? (isWeekend ? 'bg-gray-50/60 dark:bg-slate-900/40 border-gray-200 dark:border-slate-700' : 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700')
            : 'bg-gray-50/30 dark:bg-slate-900/60 border-gray-100 dark:border-slate-800'}`}
    >
      <div className={`text-[11px] font-bold w-5 h-5 flex items-center justify-center rounded-full
        ${isToday ? 'bg-green-600 text-white' : isCurrentMonth ? 'text-gray-700 dark:text-slate-300' : 'text-gray-300 dark:text-slate-600'}`}>
        {dayNum}
      </div>
      <div className="space-y-0.5 max-h-32 overflow-y-auto">
        {rows.map(r => <CardMini key={r.id} row={r} users={users} />)}
      </div>
    </div>
  )
}

function PoolColumn({ rows, users, isOver, onAssign }: {
  rows: Row[]
  users: OrgUser[]
  isOver: boolean
  onAssign: (rowId: string, technikId: string) => void
}) {
  const { setNodeRef } = useDroppable({ id: 'pool' })
  return (
    <div className="flex flex-col flex-shrink-0 w-[180px]">
      <div className="rounded-t-lg px-3 py-1.5 border border-b-0 border-gray-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-700 dark:text-slate-200 uppercase">Nezaplánované</span>
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-800 px-1.5 rounded-full">{rows.length}</span>
        </div>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[180px] rounded-b-lg border border-t-0 border-gray-200 dark:border-slate-700 p-1.5 space-y-1.5 overflow-y-auto transition-colors
          ${isOver ? 'bg-slate-200 dark:bg-slate-700/40 border-slate-400 dark:border-slate-500' : 'bg-slate-50 dark:bg-slate-800/40'}`}
        style={{ maxHeight: 'calc(100vh - 280px)' }}
      >
        {rows.length === 0 && (
          <div className={`flex items-center justify-center h-12 rounded border-2 border-dashed text-[10px] transition-colors
            ${isOver ? 'border-slate-400 text-slate-500' : 'border-gray-200 dark:border-slate-700 text-gray-300 dark:text-slate-600'}`}>
            {isOver ? 'Odebrat termín' : 'Bez termínu'}
          </div>
        )}
        {rows.map(r => <Card key={r.id} row={r} users={users} onAssign={onAssign} />)}
      </div>
    </div>
  )
}

export default function DispecinkClient({ rows: initialRows, orgUsers }: Props) {
  const router = useRouter()
  const [rows, setRows] = useState(initialRows)
  const [pivot, setPivot] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d })
  const [view, setView] = useState<'tyden' | 'mesic'>('tyden')
  const [filter, setFilter] = useState<string>('all') // 'all' | technikId | 'none'
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const today = new Date()
  const todayStr = toDateStr(today)
  const weekDays = useMemo(() => getWeekDays(pivot), [pivot])
  const monthWeeks = useMemo(() => getMonthWeeks(pivot), [pivot])
  const visibleKeys = useMemo(
    () => (view === 'tyden' ? weekDays.map(toDateStr) : monthWeeks.flat().map(toDateStr)),
    [view, weekDays, monthWeeks],
  )

  const matchesFilter = (r: Row) =>
    filter === 'all' ? true : filter === 'none' ? !r.technikId : r.technikId === filter

  const visibleRows = rows.filter(matchesFilter)
  const poolRows = visibleRows.filter(r => !r.planovanyTermin)
  const rowsByDay = useMemo(() => {
    const m: Record<string, Row[]> = {}
    for (const r of visibleRows) {
      const k = dayKey(r.planovanyTermin)
      if (k && visibleKeys.includes(k)) (m[k] ??= []).push(r)
    }
    for (const k of Object.keys(m)) m[k].sort((a, b) => (a.planovanyTermin ?? '').localeCompare(b.planovanyTermin ?? ''))
    return m
  }, [visibleRows, visibleKeys])

  const periodLabel = useMemo(() => {
    if (view === 'mesic') return `${MONTHS_NOM[pivot.getMonth()]} ${pivot.getFullYear()}`
    const a = weekDays[0], b = weekDays[6]
    if (a.getMonth() === b.getMonth()) return `${a.getDate()}.–${b.getDate()}. ${MONTHS_CS[a.getMonth()]} ${a.getFullYear()}`
    return `${a.getDate()}. ${MONTHS_CS[a.getMonth()]} – ${b.getDate()}. ${MONTHS_CS[b.getMonth()]} ${b.getFullYear()}`
  }, [view, pivot, weekDays])

  function posun(smer: -1 | 1) {
    setPivot(d => {
      const n = new Date(d)
      if (view === 'mesic') n.setMonth(n.getMonth() + smer, 1)
      else n.setDate(n.getDate() + smer * 7)
      return n
    })
  }

  async function patch(rowId: string, body: Record<string, unknown>, optimistic: Partial<Row>) {
    const prev = rows
    setRows(p => p.map(r => r.id === rowId ? { ...r, ...optimistic } : r))
    setError(null)
    try {
      const res = await fetch(`/api/servis/zakazky/${rowId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) { setRows(prev); setError('Chyba při ukládání. Zkus to znovu.'); return }
      router.refresh()
    } catch {
      setRows(prev)
      setError('Chyba při ukládání. Zkus to znovu.')
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    setOverId(null)
    const { active, over } = event
    if (!over) return
    const rowId = active.id as string
    const row = rows.find(r => r.id === rowId)
    if (!row) return
    const target = over.id as string

    if (target === 'pool') {
      if (!row.planovanyTermin) return // už je v poolu
      const stav = row.stav === 'NAPLANOVANA' ? 'NOVA' : row.stav
      patch(rowId, { planovanyTermin: null, ...(stav !== row.stav ? { stav } : {}) }, { planovanyTermin: null, stav })
      return
    }

    if (target.startsWith('day:')) {
      const dayStr = target.slice(4)
      if (dayKey(row.planovanyTermin) === dayStr) return // stejný den
      const iso = buildIso(dayStr, row.planovanyTermin)
      const stav = (row.stav === 'NOVA' || row.stav === 'CEKA') ? 'NAPLANOVANA' : row.stav
      patch(rowId, { planovanyTermin: iso, ...(stav !== row.stav ? { stav } : {}) }, { planovanyTermin: iso, stav })
    }
  }

  function assignTechnik(rowId: string, technikId: string) {
    const row = rows.find(r => r.id === rowId)
    if (!row || (row.technikId ?? '') === technikId) return
    patch(rowId, { technikId: technikId || null }, { technikId: technikId || null })
  }

  const activeRow = activeId ? rows.find(r => r.id === activeId) : null

  return (
    <div className="space-y-3">
      {error && (
        <div className="px-4 py-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400 flex items-center justify-between">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => posun(-1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700">←</button>
          <button onClick={() => setPivot(() => { const n = new Date(); n.setHours(0, 0, 0, 0); return n })} className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 dark:border-slate-600 text-gray-600 dark:text-slate-400 hover:border-green-400 hover:text-green-600">Dnes</button>
          <button onClick={() => posun(1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 dark:border-slate-700 text-gray-500 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700">→</button>
          <span className="ml-2 text-sm font-semibold text-gray-900 dark:text-white">{periodLabel}</span>
        </div>
        <div className="flex rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          {(['tyden', 'mesic'] as const).map(v => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`text-xs font-medium px-3 py-1.5 transition-colors ${view === v
                ? 'bg-green-600 text-white'
                : 'bg-white dark:bg-slate-800 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}
            >
              {v === 'tyden' ? 'Týden' : 'Měsíc'}
            </button>
          ))}
        </div>
        <Link href="/servis/zakazky" className="ml-auto px-4 py-2 rounded-lg text-sm font-semibold bg-green-600 hover:bg-green-700 text-white transition-colors">+ Nová zakázka</Link>
      </div>

      {/* Filtr techniků = zároveň legenda barev */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button onClick={() => setFilter('all')} className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === 'all' ? 'bg-green-600 text-white border-green-600' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>Vše</button>
        {orgUsers.map(u => {
          const col = techColor(u.id, orgUsers)
          return (
            <button key={u.id} onClick={() => setFilter(u.id)} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === u.id ? 'bg-gray-900 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
              <span className={`w-2 h-2 rounded-full ${col.dot}`} />{u.jmeno}
            </button>
          )
        })}
        <button onClick={() => setFilter('none')} className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-colors ${filter === 'none' ? 'bg-gray-900 dark:bg-slate-200 text-white dark:text-slate-900 border-transparent' : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-slate-400 hover:bg-gray-50 dark:hover:bg-slate-700'}`}>
          <span className="w-2 h-2 rounded-full bg-gray-400" />Nepřiřazené
        </button>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragOver={(e: DragOverEvent) => setOverId(e.over?.id != null ? String(e.over.id) : null)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-2 overflow-x-auto pb-4 -mx-1 px-1" style={{ cursor: activeId ? 'grabbing' : undefined }}>
          <PoolColumn rows={poolRows} users={orgUsers} isOver={overId === 'pool'} onAssign={assignTechnik} />
          {view === 'tyden' ? (
            weekDays.map((d, i) => {
              const ds = toDateStr(d)
              return (
                <DayColumn
                  key={ds}
                  dayStr={ds}
                  label={DAYS_CS[i]}
                  dayNum={d.getDate()}
                  isToday={ds === todayStr}
                  isPast={ds < todayStr}
                  isWeekend={i >= 5}
                  rows={rowsByDay[ds] ?? []}
                  users={orgUsers}
                  isOver={overId === `day:${ds}`}
                  onAssign={assignTechnik}
                />
              )
            })
          ) : (
            <div className="flex-1 min-w-[720px] space-y-1">
              <div className="grid grid-cols-7 gap-1">
                {DAYS_CS.map((d, i) => (
                  <div key={d} className={`text-center text-xs font-semibold py-1 ${i >= 5 ? 'text-red-400' : 'text-gray-500 dark:text-slate-400'}`}>{d}</div>
                ))}
              </div>
              {monthWeeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-1">
                  {week.map((d, i) => {
                    const ds = toDateStr(d)
                    return (
                      <MonthDayCell
                        key={ds}
                        dayStr={ds}
                        dayNum={d.getDate()}
                        isToday={ds === todayStr}
                        isCurrentMonth={d.getMonth() === pivot.getMonth()}
                        isWeekend={i >= 5}
                        rows={rowsByDay[ds] ?? []}
                        users={orgUsers}
                        isOver={overId === `day:${ds}`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          )}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeRow ? <Card row={activeRow} users={orgUsers} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
