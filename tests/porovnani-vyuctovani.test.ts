import { describe, it, expect } from 'vitest'
import { porovnejVyuctovaniSCN, type PolozkaCN, type PolozkaVyu } from '@/lib/porovnaniVyuctovani'

const cn = (p: Partial<PolozkaCN> & { nazev: string }): PolozkaCN =>
  ({ productId: null, kod: null, jednotka: 'ks', mnozstvi: 1, cenaZaKus: 100, sleva: 0, ...p })
const vy = (p: Partial<PolozkaVyu> & { nazev: string }): PolozkaVyu =>
  ({ productId: null, kod: null, jednotka: 'ks', mnozstvi: 1, prodejniCena: 100, sleva: 0, ...p })

describe('porovnejVyuctovaniSCN', () => {
  it('shoda, rozdíl, chybí a navíc', () => {
    const r = porovnejVyuctovaniSCN(
      [
        cn({ productId: 'P1', nazev: 'Venkovní jednotka', cenaZaKus: 50000 }),
        cn({ nazev: 'Montáž', jednotka: 'hod', mnozstvi: 8, cenaZaKus: 800 }),
        cn({ nazev: 'Revize', cenaZaKus: 1500 }),
      ],
      [
        vy({ productId: 'P1', nazev: 'Venkovní jednotka (přejmenovaná)', prodejniCena: 50000 }),
        vy({ nazev: 'MONTAZ', jednotka: 'hod', mnozstvi: 10, prodejniCena: 800 }),
        vy({ nazev: 'Měděné potrubí', jednotka: 'm', mnozstvi: 5, prodejniCena: 300 }),
      ],
    )
    expect(r.radky.map((x) => [x.nazev, x.stav, x.rozdil])).toEqual([
      ['Venkovní jednotka', 'SHODA', 0],
      ['Montáž', 'ROZDIL', 1600],
      ['Revize', 'CHYBI', -1500],
      ['Měděné potrubí', 'NAVIC', 1500],
    ])
    expect(r.souhrn).toMatchObject({ cnCelkem: 57900, vyuCelkem: 59500, rozdil: 1600, shoda: 1, rozdilu: 1, chybi: 1, navic: 1 })
  })

  it('položková sleva se započítá, kód páruje bez productId', () => {
    const r = porovnejVyuctovaniSCN(
      [cn({ kod: 'TC-8', nazev: 'TČ 8 kW', cenaZaKus: 100000, sleva: 10 })],
      [vy({ kod: 'tc-8', nazev: 'Tepelné čerpadlo', prodejniCena: 90000 })],
    )
    expect(r.radky[0]).toMatchObject({ stav: 'SHODA', cn: { celkem: 90000 } })
  })

  it('rozdělená položka se sečte, duplicitní položky CN se plní postupně', () => {
    const r = porovnejVyuctovaniSCN(
      [cn({ nazev: 'Potrubí', jednotka: 'm', mnozstvi: 10 }), cn({ nazev: 'Kabel', jednotka: 'm' }), cn({ nazev: 'Kabel', jednotka: 'm' })],
      [vy({ nazev: 'Potrubí', jednotka: 'm', mnozstvi: 6 }), vy({ nazev: 'Potrubí', jednotka: 'm', mnozstvi: 4 }), vy({ nazev: 'Kabel', jednotka: 'm' }), vy({ nazev: 'Kabel', jednotka: 'm' })],
    )
    expect(r.radky.map((x) => x.stav)).toEqual(['SHODA', 'SHODA', 'SHODA'])
  })

  it('stejný název, jiná jednotka = nespárovat', () => {
    const r = porovnejVyuctovaniSCN([cn({ nazev: 'Potrubí', jednotka: 'm' })], [vy({ nazev: 'Potrubí', jednotka: 'ks' })])
    expect(r.radky.map((x) => x.stav)).toEqual(['CHYBI', 'NAVIC'])
  })

  it('víc vyúčtování: součet přes zakázku + rozpad po vyúčtováních, navíc se slučuje', () => {
    const r = porovnejVyuctovaniSCN(
      [cn({ nazev: 'Montáž', jednotka: 'hod', mnozstvi: 10, cenaZaKus: 800 }), cn({ nazev: 'Revize', cenaZaKus: 1500 })],
      [
        vy({ vyuId: 'V1', nazev: 'Montáž', jednotka: 'hod', mnozstvi: 6, prodejniCena: 800 }),
        vy({ vyuId: 'V1', nazev: 'Dojezd', prodejniCena: 500 }),
        vy({ vyuId: 'V2', nazev: 'Montáž', jednotka: 'hod', mnozstvi: 4, prodejniCena: 800 }),
        vy({ vyuId: 'V2', nazev: 'Dojezd', prodejniCena: 500 }),
      ],
    )
    expect(r.radky.map((x) => [x.nazev, x.stav, x.rozdil, x.poVyu])).toEqual([
      ['Montáž', 'SHODA', 0, { V1: { mnozstvi: 6, celkem: 4800 }, V2: { mnozstvi: 4, celkem: 3200 } }],
      ['Revize', 'CHYBI', -1500, {}],
      ['Dojezd', 'NAVIC', 1000, { V1: { mnozstvi: 1, celkem: 500 }, V2: { mnozstvi: 1, celkem: 500 } }],
    ])
    expect(r.souhrn).toMatchObject({ cnCelkem: 9500, vyuCelkem: 9000, rozdil: -500 })
  })
})
