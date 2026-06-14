import { describe, it, expect } from 'vitest'
import { parseKontaktInput, PROFESE_PRESETY } from '@/lib/zakazkaKontakt'

describe('parseKontaktInput', () => {
  it('vyžaduje profesi', () => {
    const r = parseKontaktInput({ telefon: '+420123456789' })
    expect('error' in r && r.error).toBe('Profese je povinná')
  })

  it('vyžaduje telefon', () => {
    const r = parseKontaktInput({ profese: 'Elektrikář' })
    expect('error' in r && r.error).toBe('Telefon je povinný')
  })

  it('normalizuje a trimuje, prázdná volitelná pole na null', () => {
    const r = parseKontaktInput({ profese: '  Elektrikář ', telefon: ' 777 ', jmeno: '', email: ' ', poznamka: '' })
    expect('data' in r).toBe(true)
    if ('data' in r) {
      expect(r.data).toEqual({
        profese: 'Elektrikář',
        telefon: '777',
        jmeno: null,
        email: null,
        poznamka: null,
      })
    }
  })

  it('zachová vyplněná volitelná pole', () => {
    const r = parseKontaktInput({ profese: 'Podlahář', telefon: '601', jmeno: 'Jan', email: 'a@b.cz', poznamka: 'po 16h' })
    expect('data' in r && r.data.jmeno).toBe('Jan')
    expect('data' in r && r.data.email).toBe('a@b.cz')
  })

  it('odmítne příliš dlouhou profesi', () => {
    const r = parseKontaktInput({ profese: 'x'.repeat(101), telefon: '1' })
    expect('error' in r && r.error).toBe('Profese je příliš dlouhá')
  })

  it('ignoruje nestringové vstupy bezpečně', () => {
    const r = parseKontaktInput({ profese: 123, telefon: {} })
    expect('error' in r).toBe(true)
  })

  it('má neprázdné presety profesí', () => {
    expect(PROFESE_PRESETY.length).toBeGreaterThan(0)
  })
})
