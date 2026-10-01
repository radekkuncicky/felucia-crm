'use client'

import { Button } from './Button'

interface ShowMoreProps {
  remaining: number
  total: number
  step: number
  onClick: () => void
}

/** Patička dlouhého seznamu: „Zobrazit dalších 50“ + kolik je celkem. */
export default function ShowMore({ remaining, total, step, onClick }: ShowMoreProps) {
  if (remaining <= 0) return null
  return (
    <div className="flex flex-col items-center gap-1 py-3">
      <Button variant="secondary" onClick={onClick}>
        Zobrazit dalších {Math.min(step, remaining)}
      </Button>
      <span className="text-xs text-gray-500 dark:text-slate-400">
        Zobrazeno {total - remaining} z {total}
      </span>
    </div>
  )
}
