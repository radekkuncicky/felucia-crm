import { describe, it, expect } from 'vitest'
import {
  etapaProgressFromRaw, etapaKompletni, aktualniKrokEtapy, aktualniFazeLabel, lzePridatDalsiEtapu,
  type EtapaProgress,
} from '@/lib/zakazkaEtapy'

function etapa(cislo: number, overrides: Partial<Parameters<typeof etapaProgressFromRaw>[0]> = {}) {
  return etapaProgressFromRaw({ cislo, nazev: null, stav: 'PLANOVANA', predavaky: [], vyuctovani: [], ...overrides })
}

describe('etapaProgressFromRaw + aktualniKrokEtapy', () => {
  it('čerstvá etapa bez protokolu čeká na montáž', () => {
    const e = etapa(1)
    expect(aktualniKrokEtapy(e)).toBe('MONTAZ')
    expect(etapaKompletni(e)).toBe(false)
  })

  it('etapa se stavem PREDANA počítá montáž za hotovou', () => {
    const e = etapa(1, { stav: 'PREDANA' })
    expect(e.montazDone).toBe(true)
    expect(aktualniKrokEtapy(e)).toBe('PREDAVKA')
  })

  it('existující protokol (i nepodepsaný) znamená, že montáž proběhla', () => {
    const e = etapa(1, { predavaky: [{ stav: 'ROZPRACOVAN' }] })
    expect(e.montazDone).toBe(true)
    expect(e.predavkaDone).toBe(false)
    expect(aktualniKrokEtapy(e)).toBe('PREDAVKA')
  })

  it('schválený protokol -> předávka hotová, čeká na vyúčtování', () => {
    const e = etapa(1, { predavaky: [{ stav: 'SCHVALEN' }] })
    expect(e.predavkaDone).toBe(true)
    expect(aktualniKrokEtapy(e)).toBe('VYUCTOVANI')
  })

  it('schválené vyúčtování -> etapa kompletní', () => {
    const e = etapa(1, { predavaky: [{ stav: 'SCHVALEN' }], vyuctovani: [{ stav: 'SCHVALENO' }] })
    expect(etapaKompletni(e)).toBe(true)
    expect(aktualniKrokEtapy(e)).toBeNull()
  })

  it('vyúčtování v přípravě (NAVRH) ještě nestačí', () => {
    const e = etapa(1, { predavaky: [{ stav: 'SCHVALEN' }], vyuctovani: [{ stav: 'NAVRH' }] })
    expect(etapaKompletni(e)).toBe(false)
    expect(aktualniKrokEtapy(e)).toBe('VYUCTOVANI')
  })
})

describe('aktualniFazeLabel', () => {
  it('žádné etapy -> null (zakázka bez etapizace)', () => {
    expect(aktualniFazeLabel([])).toBeNull()
  })

  it('poslední etapa čerstvá -> "Montáž N"', () => {
    expect(aktualniFazeLabel([etapa(1)])).toBe('Montáž 1')
  })

  it('poslední etapa kompletní -> "Vyúčtováno NE"', () => {
    const done: EtapaProgress = { cislo: 2, nazev: null, montazDone: true, predavkaDone: true, vyuctovaniDone: true }
    expect(aktualniFazeLabel([done])).toBe('Vyúčtováno 2E')
  })

  it('bere v potaz jen poslední etapu (nejvyšší číslo)', () => {
    const prvni: EtapaProgress = { cislo: 1, nazev: null, montazDone: true, predavkaDone: true, vyuctovaniDone: true }
    const druha = etapa(2, { predavaky: [{ stav: 'SCHVALEN' }] })
    expect(aktualniFazeLabel([prvni, druha])).toBe('Vyúčtování 2')
  })
})

describe('lzePridatDalsiEtapu', () => {
  it('bez etap lze založit první', () => {
    expect(lzePridatDalsiEtapu([])).toBe(true)
  })

  it('nelze přidat další, dokud poslední není kompletně vyúčtovaná', () => {
    expect(lzePridatDalsiEtapu([etapa(1, { predavaky: [{ stav: 'SCHVALEN' }] })])).toBe(false)
  })

  it('lze přidat další, jakmile je poslední etapa kompletní', () => {
    const done = etapa(1, { predavaky: [{ stav: 'SCHVALEN' }], vyuctovani: [{ stav: 'SCHVALENO' }] })
    expect(lzePridatDalsiEtapu([done])).toBe(true)
  })
})
