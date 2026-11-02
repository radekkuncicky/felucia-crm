import { describe, it, expect } from 'vitest'
import { vychoziZaloha, zalohaPodMinimem } from '@/lib/zaloha'

/** Záloha SOD = min. 70 % ceny s DPH (KPI 1, R1) */
describe('záloha 70 % s DPH', () => {
  it('výchozí nahoru na tisíce — nikdy pod 70 %', () => {
    expect(vychoziZaloha(44508)).toBe(32000) // 70 % = 31 155,60
    expect(vychoziZaloha(100000)).toBe(70000)
    expect(vychoziZaloha(0)).toBe(0)
  })
  it('upozornění pod 70 %', () => {
    expect(zalohaPodMinimem(27000, 44508)).toBe(true) // reálná SOD-26-013: 60,7 %
    expect(zalohaPodMinimem(31156, 44508)).toBe(false)
    expect(zalohaPodMinimem(0, 44508)).toBe(false) // nevyplněno
    expect(zalohaPodMinimem(27000, 0)).toBe(false) // bez ceny
  })
})
