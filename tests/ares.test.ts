import { describe, it, expect } from 'vitest'
import { doplnZAres, mapSubjekt, buildUlice, formatPsc, type AresFirma } from '@/lib/ares'

/** Vzorek reálné odpovědi ARES (GET /ekonomicke-subjekty/{ico}, ověřeno 2026-09-18) */
const SUBJEKT = {
  ico: '27074358',
  obchodniJmeno: 'Asseco Central Europe, a.s.',
  dic: 'CZ27074358',
  pravniForma: '121',
  sidlo: {
    nazevUlice: 'Budějovická', cisloDomovni: 778, cisloOrientacni: 3, cisloOrientacniPismeno: 'a',
    nazevObce: 'Praha', nazevCastiObce: 'Michle', psc: 14000, textovaAdresa: 'Budějovická 778/3a, Michle, 14000 Praha 4',
  },
}

describe('lib/ares parsování', () => {
  it('mapSubjekt: ulice s orientačním číslem a písmenem, PSČ s mezerou', () => {
    expect(mapSubjekt(SUBJEKT)).toEqual({
      ico: '27074358',
      nazev: 'Asseco Central Europe, a.s.',
      dic: 'CZ27074358',
      ulice: 'Budějovická 778/3a',
      mesto: 'Praha',
      psc: '140 00',
      pravniForma: '121',
    })
  })

  it('obec bez ulic → část obce + číslo popisné; chybějící DIČ → null', () => {
    const s = mapSubjekt({ ico: '1', obchodniJmeno: 'Vesnická s.r.o.', sidlo: { nazevCastiObce: 'Lhota', cisloDomovni: 12, nazevObce: 'Lhota', psc: '76301' } })
    expect(s.ulice).toBe('Lhota 12')
    expect(s.dic).toBeNull()
    expect(s.psc).toBe('763 01')
  })

  it('buildUlice/formatPsc okrajové případy', () => {
    expect(buildUlice({})).toBe('')
    expect(buildUlice({ nazevUlice: 'Hlavní' })).toBe('Hlavní')
    expect(formatPsc(null)).toBe('')
    expect(formatPsc('1234')).toBe('1234')
  })
})

describe('doplnZAres', () => {
  const firma: AresFirma = { ico: '12345678', nazev: 'Firma s.r.o.', dic: null, ulice: 'Ulice 1', mesto: 'Brno', psc: '602 00', pravniForma: '112' }
  const mapa = { nazev: 'nazev', ico: 'ico', dic: 'dic', ulice: 'ulice', mesto: 'mesto', psc: 'psc' } as const

  it('vyplní jen prázdná pole, ručně zadané nechá', () => {
    const form = { nazev: 'Moje jméno', ico: '', dic: '', ulice: '  ', mesto: 'Ostrava', psc: '', email: 'a@b.cz' }
    expect(doplnZAres(form, firma, mapa)).toEqual({
      nazev: 'Moje jméno', ico: '12345678', dic: '', ulice: 'Ulice 1', mesto: 'Ostrava', psc: '602 00', email: 'a@b.cz',
    })
  })

  it('null z ARES (neplátce) neprázdné DIČ nepřepíše ani prázdné nevyplní', () => {
    expect(doplnZAres({ dic: 'CZ999' }, firma, { dic: 'dic' })).toEqual({ dic: 'CZ999' })
    expect(doplnZAres({ dic: '' }, firma, { dic: 'dic' })).toEqual({ dic: '' })
  })

  it('nemutuje vstup', () => {
    const form = { nazev: '' }
    doplnZAres(form, firma, { nazev: 'nazev' })
    expect(form.nazev).toBe('')
  })
})
