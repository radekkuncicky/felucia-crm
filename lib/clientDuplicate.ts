// Detekce duplicitních klientů při zakládání — shoda podle telefonu/emailu
// (normalizovaně) nebo přibližná shoda jména (diakritika + Levenshtein),
// když kontakt chybí. Sdíleno mezi API routou a UI, ať jde snadno testovat.

export function normalizePhone(raw: string | null | undefined): string {
  if (!raw) return ''
  let digits = raw.replace(/\D/g, '')
  if (digits.startsWith('00420') && digits.length > 9) digits = digits.slice(5)
  else if (digits.startsWith('420') && digits.length > 9) digits = digits.slice(3)
  return digits
}

export function normalizeEmail(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase()
}

const DIAKRITIKA = /[̀-ͯ]/g

export function normalizeJmeno(raw: string | null | undefined): string {
  return (raw ?? '')
    .normalize('NFD').replace(DIAKRITIKA, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const cur = [i]
    for (let j = 1; j <= b.length; j++) {
      cur[j] = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j - 1], prev[j], cur[j - 1])
    }
    prev.splice(0, prev.length, ...cur)
  }
  return prev[b.length]
}

/** Dvě jména jsou "přibližně stejná", když je Levenshtein distance malá vzhledem k délce (překlep, ne jiné jméno). */
export function jmenaJsouPodobna(a: string, b: string): boolean {
  const na = normalizeJmeno(a)
  const nb = normalizeJmeno(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const maxLen = Math.max(na.length, nb.length)
  const maxDistance = maxLen <= 6 ? 1 : maxLen <= 12 ? 2 : 3
  return levenshtein(na, nb) <= maxDistance
}

export interface KlientKandidat {
  id: string
  jmeno: string
  prijmeni: string
  telefon: string | null
  email: string | null
}

export interface DuplicitniKlientInput {
  jmeno?: string | null
  prijmeni?: string | null
  telefon?: string | null
  email?: string | null
}

/**
 * Najde nejpravděpodobnějšího duplicitního klienta. Telefon/email mají
 * přednost (jistá shoda), jméno se porovnává jen když ani jeden kontakt
 * není vyplněný — jinak by dva různí lidé se stejným jménem falešně kolidovali.
 */
export function najdiDuplicitnihoKlienta(
  kandidati: KlientKandidat[],
  input: DuplicitniKlientInput,
): KlientKandidat | null {
  const telefon = normalizePhone(input.telefon)
  const email = normalizeEmail(input.email)

  if (telefon || email) {
    for (const k of kandidati) {
      if (telefon && normalizePhone(k.telefon) === telefon) return k
      if (email && normalizeEmail(k.email) === email) return k
    }
    return null
  }

  const celeJmeno = `${input.jmeno ?? ''} ${input.prijmeni ?? ''}`.trim()
  if (!celeJmeno) return null
  for (const k of kandidati) {
    if (jmenaJsouPodobna(celeJmeno, `${k.jmeno} ${k.prijmeni}`)) return k
  }
  return null
}
