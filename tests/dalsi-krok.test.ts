import { describe, it, expect } from 'vitest'
import { urcitDalsiKrok } from '@/lib/dalsiKrok'

const zaklad = { dealId: 'd1', stav: 'NABIDKA' as const, maNabidku: true, nabidkaOdeslana: true, smlouva: null, zakazka: null }

describe('Další krok na přehledu OP', () => {
  it('bez nabídky → vytvořit nabídku', () => {
    expect(urcitDalsiKrok({ ...zaklad, maNabidku: false, nabidkaOdeslana: false })?.akce[0].href).toBe('/deals/d1?tab=nabidky')
  })
  it('neodeslaná nabídka → poslat klientovi', () => {
    expect(urcitDalsiKrok({ ...zaklad, nabidkaOdeslana: false })?.titulek).toBe('Pošlete nabídku klientovi')
  })
  it('odeslaná nabídka bez smlouvy → připravit smlouvu', () => {
    expect(urcitDalsiKrok(zaklad)?.akce[0].href).toBe('/deals/d1?tab=smlouvy')
  })
  it('smlouva odeslaná → čeká na podpis', () => {
    expect(urcitDalsiKrok({ ...zaklad, smlouva: { id: 's1', stav: 'ODESLANO' } })?.akce[0].href).toBe('/sod/s1')
  })
  it('existuje zakázka → otevřít zakázku', () => {
    expect(urcitDalsiKrok({ ...zaklad, stav: 'USPECH', zakazka: { id: 'z1', cislo: '26-901' } })?.akce[0].href).toBe('/zakazky/z1')
  })
  it('prohraný OP → nic', () => {
    expect(urcitDalsiKrok({ ...zaklad, stav: 'PAS' })).toBeNull()
  })
})
