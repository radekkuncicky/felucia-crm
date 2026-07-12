'use client'

import { useState } from 'react'
import Link from 'next/link'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import {
  DndContext, DragEndEvent, DragOverlay, DragStartEvent,
  PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { StavDealu, Technologie } from '@prisma/client'
import { stavLabels, techLabels, techColors } from '@/lib/constants'
import { formatDate, formatKcCompact } from '@/lib/format'

export interface KanbanDeal {
  id: string
  kod: string | null
  predmet: string | null
  stav: StavDealu
  technologie: Technologie
  clientJmeno: string
  userJmeno: string | null
  konecnaCena: number
  dphSazba: number
  vytvoreno: string
  terminRealizace: string | null
}

interface Props {
  deals: KanbanDeal[]
}

const COLUMNS: { stav: StavDealu; color: string; header: string; dot: string }[] = [
  { stav: 'NOVY',           color: 'border-t-gray-400',    header: 'bg-gray-50 dark:bg-slate-800',   dot: 'bg-gray-400' },
  { stav: 'JEDNANI',        color: 'border-t-blue-500',    header: 'bg-blue-50 dark:bg-blue-950/40', dot: 'bg-blue-500' },
  { stav: 'NABIDKA',        color: 'border-t-yellow-500',  header: 'bg-yellow-50 dark:bg-yellow-950/40', dot: 'bg-yellow-500' },
  { stav: 'PRED_UZAVRENIM', color: 'border-t-orange-500',  header: 'bg-orange-50 dark:bg-orange-950/40', dot: 'bg-orange-500' },
  { stav: 'USPECH',         color: 'border-t-green-500',   header: 'bg-green-50 dark:bg-green-950/40',  dot: 'bg-green-500' },
  { stav: 'PAS',            color: 'border-t-red-500',     header: 'bg-red-50 dark:bg-red-950/40',     dot: 'bg-red-500' },
]

function fmtKc(n: number) {
  if (n === 0) return '—'
  return formatKcCompact(n)
}

function KanbanCard({ deal, overlay = false }: { deal: KanbanDeal; overlay?: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: deal.id,
    data: { stav: deal.stav },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined

  const cenaSDph = deal.konecnaCena * (1 + deal.dphSazba / 100)

  const card = (
    <div
      className={`bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2 select-none
        ${isDragging ? 'opacity-40' : ''}
        ${overlay ? 'shadow-2xl rotate-1 scale-105 opacity-95' : 'hover:border-primary-light dark:hover:border-primary-dark hover:shadow-sm transition-all'}
      `}
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          {deal.kod && (
            <span className="text-[10px] font-mono text-gray-400 dark:text-slate-500">{deal.kod}</span>
          )}
          <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight truncate">
            {deal.predmet ?? 'Bez předmětu'}
          </p>
        </div>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0 ${techColors[deal.technologie]}`}>
          {techLabels[deal.technologie]}
        </span>
      </div>

      {/* Client */}
      <p className="text-xs text-gray-500 dark:text-slate-400 truncate">
        👤 {deal.clientJmeno}
      </p>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 pt-0.5 border-t border-gray-100 dark:border-slate-700">
        <span className="text-xs font-semibold text-gray-700 dark:text-slate-300">
          {fmtKc(deal.konecnaCena)}
          {deal.konecnaCena > 0 && (
            <span className="text-[10px] text-gray-400 dark:text-slate-500 font-normal ml-1">
              ({fmtKc(cenaSDph)} s DPH)
            </span>
          )}
        </span>
        {deal.userJmeno && (
          <span className="text-[10px] text-gray-400 dark:text-slate-500 truncate max-w-[70px]">{deal.userJmeno}</span>
        )}
      </div>

      {deal.terminRealizace && (
        <p className="text-[10px] text-orange-600 dark:text-orange-400">
          Realizace: {formatDate(deal.terminRealizace)}
        </p>
      )}
    </div>
  )

  if (overlay) return card

  return (
    <div ref={setNodeRef} style={style} {...listeners} {...attributes} className="cursor-grab active:cursor-grabbing touch-none">
      <Link href={`/deals/${deal.id}`} onClick={e => { if (transform) e.preventDefault() }}>
        {card}
      </Link>
    </div>
  )
}

function KanbanColumn({
  stav, color, header, dot, deals, isOver,
}: {
  stav: StavDealu; color: string; header: string; dot: string
  deals: KanbanDeal[]; isOver: boolean
}) {
  const { setNodeRef } = useDroppable({ id: stav })
  const totalValue = deals.reduce((s, d) => s + d.konecnaCena, 0)

  return (
    <div className="flex flex-col flex-shrink-0" style={{ width: 252 }}>
      {/* Column header */}
      <div className={`rounded-t-xl px-3 py-2.5 border-t-4 ${color} ${header} border border-gray-200 dark:border-slate-700 border-b-0`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dot}`} />
            <span className="text-sm font-semibold text-gray-800 dark:text-slate-200">{stavLabels[stav]}</span>
          </div>
          <span className="text-xs font-bold text-gray-500 dark:text-slate-400 bg-white dark:bg-slate-700 px-2 py-0.5 rounded-full">
            {deals.length}
          </span>
        </div>
        {totalValue > 0 && (
          <p className="text-[11px] text-gray-500 dark:text-slate-400 mt-0.5 pl-4">{fmtKc(totalValue)}</p>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-[200px] rounded-b-xl border border-t-0 border-gray-200 dark:border-slate-700 p-2 space-y-2 overflow-y-auto transition-colors
          ${isOver ? 'bg-blue-50 dark:bg-blue-950/20 border-blue-300 dark:border-blue-600' : 'bg-gray-50/50 dark:bg-slate-900/50'}
        `}
        style={{ maxHeight: 'calc(100vh - 260px)' }}
      >
        {deals.length === 0 && (
          <div className={`flex items-center justify-center h-16 rounded-lg border-2 border-dashed text-xs text-gray-300 dark:text-slate-600 transition-colors
            ${isOver ? 'border-blue-400 text-blue-400' : 'border-gray-200 dark:border-slate-700'}`}>
            {isOver ? 'Pustit zde' : 'Přetáhnout sem'}
          </div>
        )}
        {deals.map(deal => (
          <KanbanCard key={deal.id} deal={deal} />
        ))}
      </div>
    </div>
  )
}

export default function DealsKanban({ deals: initialDeals }: Props) {
  const [deals, setDeals] = useState(initialDeals)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [overId, setOverId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string)
  }

  function handleDragOver(event: { over: { id: string } | null }) {
    setOverId(event.over?.id ?? null)
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveId(null)
    setOverId(null)
    const { active, over } = event
    if (!over) return
    const dealId = active.id as string
    const newStav = over.id as StavDealu
    const deal = deals.find(d => d.id === dealId)
    if (!deal || deal.stav === newStav) return

    const prevDeals = deals
    setDeals(prev => prev.map(d => d.id === dealId ? { ...d, stav: newStav } : d))

    const res = await api.patch<{ chybaPovinnaAktivita?: boolean }>(`/api/deals/${dealId}`,
      { stav: newStav },
      { errorMessage: 'Změnu stavu se nepodařilo uložit. Zkuste to prosím znovu.' })

    if (!res.ok) {
      setDeals(prevDeals)
      return
    }

    if (res.data?.chybaPovinnaAktivita) {
      setDeals(prevDeals)
      toast.warning('Pro uzavření OP je vyžadována aktivita typu Hovor nebo Schůzka.')
    }
  }

  const activeDeal = activeId ? deals.find(d => d.id === activeId) : null

  return (
    <div>
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver as never}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-3 overflow-x-auto pb-4 -mx-1 px-1" style={{ cursor: activeId ? 'grabbing' : undefined }}>
          {COLUMNS.map(col => (
            <KanbanColumn
              key={col.stav}
              stav={col.stav}
              color={col.color}
              header={col.header}
              dot={col.dot}
              deals={deals.filter(d => d.stav === col.stav)}
              isOver={overId === col.stav}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeDeal ? <KanbanCard deal={activeDeal} overlay /> : null}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
