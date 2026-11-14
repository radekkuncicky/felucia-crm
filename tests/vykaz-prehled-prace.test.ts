import { describe, it, expect } from 'vitest'
import { prehledPrace } from '@/lib/vykazPrace'

const zak = (id: string) => ({ id, cislo: `Z-${id}`, nazev: `Zakázka ${id}` })
const z = (o: Record<string, unknown>) => ({
  id: Math.random().toString(36).slice(2), orgId: 'o', typ: 'VYJEZD', zakazkaId: null, servisniZakazkaId: null,
  datum: new Date('2026-11-05T00:00:00Z'), hodiny: 0, km: 0, sazbaHodina: 400, sazbaKm: 8, popis: null, castka: null,
  poznamka: null, fakturaceId: null, vytvoreno: new Date(), upraveno: new Date(), zakazka: null, servisniZakazka: null,
  ...o,
}) as never

describe('prehledPrace', () => {
  it('seskupí technik → zakázka, sečte výjezdy, položky a uzavřenou část', () => {
    const p = prehledPrace([
      z({ userId: 'a', user: { jmeno: 'Veči' }, zakazkaId: '1', zakazka: zak('1'), hodiny: 2, km: 10 }),
      z({ userId: 'a', user: { jmeno: 'Veči' }, zakazkaId: '1', zakazka: zak('1'), typ: 'POLOZKA', popis: 'Měď', castka: 500, fakturaceId: 'f' }),
      z({ userId: 'a', user: { jmeno: 'Veči' }, zakazkaId: '2', zakazka: zak('2'), hodiny: 1, km: 0 }),
      z({ userId: 'b', user: { jmeno: 'Tomáš' }, zakazkaId: '2', zakazka: zak('2'), hodiny: 8, km: 100 }),
    ])
    expect(p.map(t => t.jmeno)).toEqual(['Tomáš', 'Veči'])
    const veci = p[1]
    expect(veci.soucty.castka).toBe(2 * 400 + 10 * 8 + 500 + 400)
    expect(veci.uzavreno).toBe(500)
    expect(veci.zakazky.map(x => x.zakazka.cislo)).toEqual(['Z-1', 'Z-2'])
    expect(veci.zakazky[0].zaznamy).toHaveLength(2)
    expect(veci.zakazky[0].soucty.castkaPolozky).toBe(500)
  })
})
