// Hledání bez ohledu na diakritiku a velikost písmen („novak“ najde „Novák“).
// Čisté funkce — sdílí je UI (filtrování v prohlížeči) i server (lib/clientSearch.ts).

const DIAKRITIKA = /[̀-ͯ]/g

/** „Kunčický“ → „kuncicky“. */
export function bezDiakritiky(s: string | null | undefined): string {
  return (s ?? '').normalize('NFD').replace(DIAKRITIKA, '').toLowerCase()
}

/** Dotaz rozdělený na slova (bez diakritiky, max. 6 slov). */
export function hledanaSlova(q: string | null | undefined): string[] {
  return bezDiakritiky(q).split(/\s+/).filter(Boolean).slice(0, 6)
}

/**
 * Každé slovo dotazu musí být někde v textu (pořadí nehraje roli),
 * takže „jan novak“ i „novak jan“ najdou „Jan Novák“.
 */
export function odpovidaHledani(q: string | null | undefined, ...pole: (string | null | undefined)[]): boolean {
  const slova = hledanaSlova(q)
  if (slova.length === 0) return true
  const text = bezDiakritiky(pole.filter(Boolean).join(' '))
  const textBezMezer = text.replace(/\s+/g, '')
  return slova.every((s) => text.includes(s) || textBezMezer.includes(s))
}
