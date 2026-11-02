'use client'

import { Button } from '@/components/ui/Button'
import { formatCislo, formatKc } from '@/lib/format'
import { vychoziZaloha, zalohaPodMinimem } from '@/lib/zaloha'

/** Upozornění pod polem zálohy: pod 70 % ceny s DPH (KPI 1) + oprava jedním klikem */
export function ZalohaUpozorneni({ zaloha, cenaSDph, onNastavit }: {
  zaloha: number
  cenaSDph: number
  onNastavit: (castka: number) => void
}) {
  if (!zalohaPodMinimem(zaloha, cenaSDph)) return null
  const spravne = vychoziZaloha(cenaSDph)
  return (
    <p role="status" className="mt-1.5 text-xs text-amber-700 dark:text-amber-400">
      Záloha je {formatCislo(Math.round((zaloha / cenaSDph) * 1000) / 10)} % ceny s DPH, minimum je 70 %.{' '}
      <Button type="button" variant="link" data-compact className="hit-area text-xs align-baseline" onClick={() => onNastavit(spravne)}>
        Nastavit {formatKc(spravne)}
      </Button>
    </p>
  )
}
