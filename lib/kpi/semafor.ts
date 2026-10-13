import type { KpiSmer } from './registry'

export type Semafor = 'ZELENA' | 'ORANZOVA' | 'CERVENA' | 'BEZ_CILE' | 'BEZ_DAT'

/** Oranžová = horší než cíl nejvýš o 10 % cíle (relativně, Radek 2026-10-11). */
export const ORANZOVA_PASMO = 0.1

/**
 * Semafor proti cíli. U cíle 0 relativní pásmo nedává smysl → jen zelená / červená.
 * Bez hodnoty šedá (nikdy zelená bez dat), bez cíle jen hodnota.
 */
export function semafor(hodnota: number | null, cil: number | null, smer: KpiSmer): Semafor {
  if (hodnota === null || !Number.isFinite(hodnota)) return 'BEZ_DAT'
  if (cil === null) return 'BEZ_CILE'
  const pasmo = Math.abs(cil) * ORANZOVA_PASMO
  if (smer === 'VYSSI') {
    if (hodnota >= cil) return 'ZELENA'
    return pasmo > 0 && hodnota >= cil - pasmo ? 'ORANZOVA' : 'CERVENA'
  }
  if (hodnota <= cil) return 'ZELENA'
  return pasmo > 0 && hodnota <= cil + pasmo ? 'ORANZOVA' : 'CERVENA'
}
