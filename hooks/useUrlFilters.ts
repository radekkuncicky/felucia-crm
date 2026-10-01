'use client'

import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'

/**
 * Stav filtrů seznamu zrcadlený do URL (replaceState) — refresh, návrat zpět
 * i sdílený odkaz zachovají pohled; KPI na nástěnce mohou odkazovat s filtrem.
 * Hodnota rovná výchozí se do URL nepíše. Cizí parametry (např. ?view) zůstávají.
 */
export function useUrlFilters<T extends Record<string, string>>(defaults: T) {
  const searchParams = useSearchParams()
  const [values, setValues] = useState<T>(() => {
    const init = { ...defaults }
    for (const key of Object.keys(defaults) as (keyof T)[]) {
      const v = searchParams.get(key as string)
      if (v !== null) init[key] = v as T[keyof T]
    }
    return init
  })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    for (const key of Object.keys(defaults)) {
      const v = values[key]
      if (v && v !== defaults[key]) params.set(key, v)
      else params.delete(key)
    }
    const qs = params.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
    // defaults jsou konstanta volajícího
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  const set = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues(prev => (prev[key] === value ? prev : { ...prev, [key]: value }))
  }, [])

  const reset = useCallback((keep: (keyof T)[] = []) => {
    setValues(prev => {
      const next = { ...defaults }
      for (const k of keep) next[k] = prev[k]
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Počet aktivních filtrů mimo vyjmenované klíče (typicky hledání a pohled) */
  const activeCount = (exclude: (keyof T)[] = []) =>
    (Object.keys(defaults) as (keyof T)[]).filter(k => !exclude.includes(k) && values[k] !== defaults[k]).length

  return { values, set, reset, activeCount }
}
