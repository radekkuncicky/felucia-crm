import { useState, useEffect } from 'react'
import type { AresFirma } from '@/app/api/ares/route'

export type { AresFirma }

export function useAresLookup(query: string) {
  const [results, setResults] = useState<AresFirma[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/ares?q=${encodeURIComponent(q)}`)
        if (res.ok) {
          const data = await res.json() as AresFirma[]
          setResults(data)
        } else {
          setResults([])
        }
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => {
      clearTimeout(timer)
      setLoading(false)
    }
  }, [query])

  return { results, loading }
}
