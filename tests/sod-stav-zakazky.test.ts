import { describe, it, expect } from 'vitest'
import { sodStavZakazky, type SodProStav } from '@/lib/sodStavZakazky'

const d = (s: string) => new Date(s)
const sod = (id: string, stav: string, vytvoreno: string, podepsano: string | null = null): SodProStav =>
  ({ id, cislo: `SOD-${id}`, stav, vytvoreno: d(vytvoreno), podepsano: podepsano ? d(podepsano) : null })

describe('sodStavZakazky', () => {
  it('bez SOD a bez papíru', () => {
    expect(sodStavZakazky([], null)).toMatchObject({ kod: 'BEZ_SOD', sod: null })
  })
  it('návrh / k internímu podpisu = neodeslaná', () => {
    expect(sodStavZakazky([sod('1', 'K_INTERNIMU_PODPISU', '2026-11-01')], null)).toMatchObject({ kod: 'NEODESLANA', sod: { id: '1' } })
  })
  it('odeslaná má přednost před novějším návrhem', () => {
    const r = sodStavZakazky([sod('1', 'ODESLANO', '2026-11-01'), sod('2', 'NAVRH', '2026-11-05')], null)
    expect(r).toMatchObject({ kod: 'ODESLANA', sod: { id: '1' } })
  })
  it('online podpis vyhrává nad papírem, storno se ignoruje', () => {
    const r = sodStavZakazky([sod('1', 'PODEPSANO', '2026-11-01', '2026-11-03'), sod('2', 'STORNO', '2026-11-05')], d('2026-11-04'))
    expect(r).toMatchObject({ kod: 'PODEPSANA', sod: { id: '1' }, datum: d('2026-11-03') })
  })
  it('papírový příznak bez online podpisu', () => {
    expect(sodStavZakazky([sod('1', 'ODESLANO', '2026-11-01')], d('2026-11-04'))).toMatchObject({ kod: 'PODEPSANA_PAPIROVE', label: 'Podepsaná (papírově)' })
    expect(sodStavZakazky([], d('2026-11-04'))).toMatchObject({ kod: 'PODEPSANA_PAPIROVE', sod: null })
  })
  it('jen stornovaná / expirovaná = bez SOD', () => {
    expect(sodStavZakazky([sod('1', 'STORNO', '2026-11-01'), sod('2', 'EXPIROVANO', '2026-11-02')], null).kod).toBe('BEZ_SOD')
  })
})
