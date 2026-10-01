'use client'

import { useEffect, useState } from 'react'

export const SHOW_MORE_STEP = 50

/**
 * Vykreslí jen prvních N řádků, „Zobrazit další“ přidá dalších 50.
 * Změna filtrů (resetKey) vrací na začátek. Data jsou celá v klientu —
 * jde o rychlost vykreslení dlouhých seznamů, ne o serverové stránkování.
 */
export function useShowMore<T>(items: T[], resetKey: unknown, step = SHOW_MORE_STEP) {
  const [limit, setLimit] = useState(step)
  const key = JSON.stringify(resetKey)
  useEffect(() => { setLimit(step) }, [key, step])
  return {
    visible: items.length > limit ? items.slice(0, limit) : items,
    remaining: Math.max(0, items.length - limit),
    total: items.length,
    showMore: () => setLimit(l => l + step),
    step,
  }
}
