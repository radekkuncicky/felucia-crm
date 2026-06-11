'use client'

import { useState, useRef, useEffect } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ColumnDef, ColumnState } from '@/hooks/useTableColumns'

interface Props {
  columns: ColumnState[]
  defs: ColumnDef[]
  onToggle: (id: string, visible: boolean) => void
  onReorder: (newOrder: string[]) => void
  onReset: () => void
}

function SortableColRow({
  col,
  label,
  onToggle,
}: {
  col: ColumnState
  label: string
  onToggle: (id: string, visible: boolean) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: col.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 dark:hover:bg-slate-700 select-none"
    >
      <span
        {...attributes}
        {...listeners}
        className="text-gray-300 dark:text-slate-600 cursor-grab active:cursor-grabbing flex-shrink-0"
        title="Přetáhnout"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.2" />
          <circle cx="10" cy="3" r="1.2" />
          <circle cx="4" cy="7" r="1.2" />
          <circle cx="10" cy="7" r="1.2" />
          <circle cx="4" cy="11" r="1.2" />
          <circle cx="10" cy="11" r="1.2" />
        </svg>
      </span>
      <label className="flex items-center gap-2 flex-1 cursor-pointer min-w-0">
        <input
          type="checkbox"
          checked={col.visible}
          onChange={e => onToggle(col.id, e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 flex-shrink-0"
        />
        <span className="text-sm text-gray-700 dark:text-slate-300 truncate">{label}</span>
      </label>
    </div>
  )
}

export default function ColumnConfigButton({ columns, defs, onToggle, onReorder, onReset }: Props) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const btnRef = useRef<HTMLButtonElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const ids = columns.map(c => c.id)
    const oldIdx = ids.indexOf(active.id as string)
    const newIdx = ids.indexOf(over.id as string)
    onReorder(arrayMove(ids, oldIdx, newIdx))
  }

  const labelMap = Object.fromEntries(defs.map(d => [d.id, d.label]))

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(v => !v)}
        className={`p-1.5 rounded-lg border transition-colors ${
          open
            ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30 text-primary dark:text-primary-light'
            : 'border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-500 dark:text-slate-400 hover:border-gray-400 dark:hover:border-slate-500'
        }`}
        title="Nastavit sloupce"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-800 border border-green-400 dark:border-green-600 rounded-xl shadow-lg"
          style={{ width: 220 }}
        >
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase tracking-wide">Sloupce tabulky</p>
          </div>
          <div className="overflow-y-auto py-1" style={{ maxHeight: 360 }}>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={columns.map(c => c.id)} strategy={verticalListSortingStrategy}>
                {columns.map(col => (
                  <SortableColRow
                    key={col.id}
                    col={col}
                    label={labelMap[col.id] ?? col.id}
                    onToggle={onToggle}
                  />
                ))}
              </SortableContext>
            </DndContext>
          </div>
          <div className="px-3 py-2 border-t border-gray-100 dark:border-slate-700">
            <button
              onClick={onReset}
              className="w-full text-xs text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 py-1 rounded hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors"
            >
              Obnovit výchozí
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
