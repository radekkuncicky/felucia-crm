/**
 * Společná pravidla pro přihlašovací vstupy — e-mail a heslo. Platí pro web,
 * mobilní appky, registraci, pozvánky i reset. Bez Node závislostí (jde i do klienta).
 */

/** E-mail se ukládá i hledá ořezaný a malými písmeny („Petr.Novak@Firma.cz ␠“ = „petr.novak@firma.cz“) */
export function normalizeEmail(v: unknown): string {
  return typeof v === 'string' ? v.trim().toLowerCase() : ''
}

export function isValidEmail(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)
}

/** Prisma filtr: e-mail bez ohledu na velikost písmen (pojistka pro starší záznamy uložené s velkými písmeny) */
export function emailWhere(email: string) {
  return { equals: normalizeEmail(email), mode: 'insensitive' as const }
}

export const PASSWORD_MIN = 10
/** bcrypt bere jen prvních 72 bajtů — delší heslo by se potichu zkrátilo */
export const PASSWORD_MAX_BYTES = 72
export const PASSWORD_HINT = `Alespoň ${PASSWORD_MIN} znaků. Klidně věta, kterou si zapamatujete.`

/** Vrátí českou chybovou hlášku, nebo null když je heslo v pořádku */
export function passwordError(v: unknown): string | null {
  if (typeof v !== 'string' || v.length < PASSWORD_MIN) return `Heslo musí mít alespoň ${PASSWORD_MIN} znaků.`
  if (new TextEncoder().encode(v).length > PASSWORD_MAX_BYTES) return 'Heslo je příliš dlouhé (max. 72 znaků bez diakritiky).'
  return null
}
