import { describe, it, expect } from 'vitest'
import { resolveZakazkaTab, vychoziZakazkaTab, zakazkaTabZCesty, ZAKAZKA_TABY } from '@/lib/zakazkaTaby'

describe('taby detailu zakázky', () => {
  it('je jich 6', () => {
    expect(ZAKAZKA_TABY).toHaveLength(6)
  })

  it('výchozí tab podle role', () => {
    expect(vychoziZakazkaTab(true)).toBe('protokoly')
    expect(vychoziZakazkaTab(false)).toBe('polozky')
    expect(resolveZakazkaTab(undefined, 'protokoly')).toEqual({ tab: 'protokoly', presmerovat: null })
  })

  it('staré odkazy z e-mailů a notifikací se přesměrují na nový tab s kotvou', () => {
    expect(resolveZakazkaTab('vyuctovani', 'polozky')).toEqual({ tab: 'protokoly', presmerovat: { tab: 'protokoly', kotva: 'vyuctovani' } })
    expect(resolveZakazkaTab('predavaky', 'polozky').presmerovat?.tab).toBe('protokoly')
    expect(resolveZakazkaTab('objednavky', 'polozky').presmerovat).toEqual({ tab: 'polozky', kotva: 'objednavky' })
    expect(resolveZakazkaTab('foto', 'polozky').presmerovat).toEqual({ tab: 'podklady', kotva: 'foto' })
  })

  it('nové klíče beze změny, neznámý spadne na výchozí', () => {
    expect(resolveZakazkaTab('ukoly', 'polozky')).toEqual({ tab: 'ukoly', presmerovat: null })
    expect(resolveZakazkaTab('nesmysl', 'polozky')).toEqual({ tab: 'polozky', presmerovat: null })
  })

  it('podstránky zvýrazní správný tab', () => {
    expect(zakazkaTabZCesty('/zakazky/x/vyuctovani/y')).toBe('protokoly')
    expect(zakazkaTabZCesty('/zakazky/x/predavaky/y')).toBe('protokoly')
    expect(zakazkaTabZCesty('/zakazky/x/objednavky/y')).toBe('polozky')
    expect(zakazkaTabZCesty('/zakazky/x')).toBeNull()
  })
})
