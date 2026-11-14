import { describe, it, expect } from 'vitest'
import { dnesPraha, zitraPraha, dnesPrahaRozsah, posunDen } from '@/lib/datumPraha'

describe('datumPraha', () => {
  it('po půlnoci pražského času je už nový den (UTC je ještě včera)', () => {
    // 14. 11. 23:30 UTC = 15. 11. 00:30 v Praze (zimní čas, +1)
    const now = new Date('2026-11-14T23:30:00Z')
    expect(dnesPraha(now)).toBe('2026-11-15')
    expect(zitraPraha(now)).toBe('2026-11-16')
    const r = dnesPrahaRozsah(now)
    expect(r.od.toISOString()).toBe('2026-11-15T00:00:00.000Z')
    expect(r.do.toISOString()).toBe('2026-11-16T00:00:00.000Z')
  })

  it('letní čas (+2) a přelom měsíce', () => {
    expect(dnesPraha(new Date('2026-06-30T22:15:00Z'))).toBe('2026-07-01')
    expect(dnesPraha(new Date('2026-06-30T21:59:00Z'))).toBe('2026-06-30')
    expect(posunDen('2026-12-31', 1)).toBe('2027-01-01')
  })
})
