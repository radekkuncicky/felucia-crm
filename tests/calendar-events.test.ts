import { describe, it, expect } from 'vitest'
import { klientJmeno, shiftRange, diffDays, zarizeniTech } from '@/lib/calendarEvents'

describe('kalendář — jméno klienta', () => {
  it('fyzická osoba = jméno + příjmení', () => {
    expect(klientJmeno({ jmeno: 'Jan', prijmeni: 'Novák', typKlienta: 'FYZICKA_OSOBA' })).toBe('Jan Novák')
  })
  it('firma = jen název firmy, bez kontaktní osoby', () => {
    expect(klientJmeno({ jmeno: 'ATIV RENTAL GROUP s.r.o.', prijmeni: 'Karin Vitová', typKlienta: 'FIRMA' }))
      .toBe('ATIV RENTAL GROUP s.r.o.')
  })
  it('bez typu se chová jako dřív', () => {
    expect(klientJmeno({ jmeno: 'Jan', prijmeni: 'Novák' })).toBe('Jan Novák')
    expect(klientJmeno(null)).toBe('')
  })
})

describe('kalendář — posun montáže přetažením', () => {
  it('rozdíl dnů přes přechod měsíce i letního času', () => {
    expect(diffDays('2026-10-24', '2026-10-27')).toBe(3)
    expect(diffDays('2026-03-30', '2026-03-27')).toBe(-3)
  })
  it('vícedenní rozsah zachová délku přes konec roku', () => {
    expect(shiftRange('2026-12-30', '2027-01-02', 3)).toEqual({ date: '2027-01-02', dateTo: '2027-01-05' })
  })
  it('jednodenní akce nemá dateTo', () => {
    expect(shiftRange('2026-09-30', undefined, 1)).toEqual({ date: '2026-10-01' })
  })
})

describe('kalendář — technologie servisu', () => {
  it('mapuje typ zařízení na technologii', () => {
    expect(zarizeniTech({ typ: 'KLIMATIZACE' })).toBe('KLIMA')
    expect(zarizeniTech({ typ: 'OHREV_TV' })).toBe('JINE')
    expect(zarizeniTech(null)).toBeUndefined()
  })
})
