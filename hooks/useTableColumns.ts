'use client'

import { useState, useEffect, useCallback } from 'react'

export interface ColumnDef {
  id: string
  label: string
  defaultVisible?: boolean
  defaultWidth?: number
}

export interface ColumnState {
  id: string
  visible: boolean
  width?: number
}

function makeDefault(defs: ColumnDef[]): ColumnState[] {
  return defs.map(d => ({
    id: d.id,
    visible: d.defaultVisible !== false,
    width: d.defaultWidth,
  }))
}

function storageKey(tableId: string, userId: string) {
  return `felucia_table_${tableId}_${userId}`
}

export function useTableColumns(tableId: string, userId: string, defs: ColumnDef[]) {
  const [columns, setColumns] = useState<ColumnState[]>(() => makeDefault(defs))
  const [loaded, setLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey(tableId, userId))
      if (raw) {
        const saved: ColumnState[] = JSON.parse(raw)
        // Merge saved state with defs (new columns added since save get defaults)
        const merged = defs.map(d => {
          const s = saved.find(c => c.id === d.id)
          return s ?? { id: d.id, visible: d.defaultVisible !== false, width: d.defaultWidth }
        })
        // Preserve ordering from saved (for columns that exist in both)
        const savedOrder = saved.map(s => s.id).filter(id => defs.some(d => d.id === id))
        const newCols = merged.filter(c => !savedOrder.includes(c.id))
        const ordered = [...savedOrder.map(id => merged.find(c => c.id === id)!), ...newCols]
        setColumns(ordered)
      }
    } catch {
      // ignore
    }
    setLoaded(true)
  }, [tableId, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Persist to localStorage whenever columns change (after initial load)
  useEffect(() => {
    if (!loaded) return
    try {
      localStorage.setItem(storageKey(tableId, userId), JSON.stringify(columns))
    } catch {
      // ignore
    }
  }, [columns, loaded, tableId, userId])

  const updateColumn = useCallback((id: string, patch: Partial<ColumnState>) => {
    setColumns(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }, [])

  const resizeColumn = useCallback((id: string, dx: number) => {
    setColumns(prev => prev.map(c => {
      if (c.id !== id) return c
      return { ...c, width: Math.max(60, (c.width ?? 120) + dx) }
    }))
  }, [])

  const resetColumns = useCallback(() => {
    setColumns(makeDefault(defs))
    try {
      localStorage.removeItem(storageKey(tableId, userId))
    } catch {
      // ignore
    }
  }, [defs, tableId, userId])

  const reorderColumns = useCallback((newOrder: string[]) => {
    setColumns(prev => {
      const map = new Map(prev.map(c => [c.id, c]))
      return newOrder.map(id => map.get(id)!).filter(Boolean)
    })
  }, [])

  const visibleColumns = columns.filter(c => c.visible)

  return { columns, visibleColumns, updateColumn, resizeColumn, resetColumns, reorderColumns }
}
