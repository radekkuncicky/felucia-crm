// Kontakty na zakázce — subdodavatelé / lidé na stavbě (elektrikář, stavbyvedoucí, …)

/** Rychlé presety profesí pro UI (volný text zůstává možný) */
export const PROFESE_PRESETY = [
  'Elektrikář',
  'Stavbyvedoucí',
  'Stavební dozor',
  'Podlahář',
  'Vodař / instalatér',
  'Topenář',
  'Zedník',
  'Vzduchotechnika',
  'Malíř',
  'Investor',
] as const

type KontaktData = {
  profese: string
  jmeno: string | null
  telefon: string | null
  email: string | null
  poznamka: string | null
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Validace a normalizace vstupu kontaktu. Profese je povinná, telefon povinný
 * (kontakt = „číslo na stavbě"). Jméno/email/poznámka volitelné.
 */
export function parseKontaktInput(body: unknown): { data: KontaktData } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>

  const profese = str(b.profese)
  if (!profese) return { error: 'Profese je povinná' }
  if (profese.length > 100) return { error: 'Profese je příliš dlouhá' }

  const telefon = str(b.telefon)
  if (!telefon) return { error: 'Telefon je povinný' }
  if (telefon.length > 50) return { error: 'Telefon je příliš dlouhý' }

  const jmeno = str(b.jmeno)
  if (jmeno.length > 200) return { error: 'Jméno je příliš dlouhé' }

  const email = str(b.email)
  if (email.length > 200) return { error: 'Email je příliš dlouhý' }

  const poznamka = str(b.poznamka)
  if (poznamka.length > 1000) return { error: 'Poznámka je příliš dlouhá' }

  return {
    data: {
      profese,
      jmeno: jmeno || null,
      telefon,
      email: email || null,
      poznamka: poznamka || null,
    },
  }
}
