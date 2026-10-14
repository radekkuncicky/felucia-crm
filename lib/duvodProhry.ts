// Důvod prohry OP — povinný při přechodu do PAS (web i mobil). Bez importu z @prisma/client,
// ať jde použít i v klientských komponentách.

export const DUVODY_PROHRY = ['CENA', 'KONKURENCE', 'ODLOZENO', 'NEREAGOVAL', 'JINE'] as const
export type DuvodProhryKod = (typeof DUVODY_PROHRY)[number]

export const DUVOD_PROHRY_LABEL: Record<DuvodProhryKod, string> = {
  CENA: 'Cena',
  KONKURENCE: 'Konkurence',
  ODLOZENO: 'Odloženo',
  NEREAGOVAL: 'Klient nereagoval',
  JINE: 'Jiné',
}

export function jeDuvodProhry(v: unknown): v is DuvodProhryKod {
  return typeof v === 'string' && (DUVODY_PROHRY as readonly string[]).includes(v)
}
