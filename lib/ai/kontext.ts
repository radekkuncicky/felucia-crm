/** Max. délka firemního kontextu pro AI asistentku (Organization.aiContext) */
export const AI_CONTEXT_MAX = 8000

/**
 * Sekce systémového promptu s firemním kontextem. Volající ho načítá VÝHRADNĚ
 * podle orgId ze session / ověřeného tokenu — nikdy podle vstupu klienta či modelu.
 */
export function firemniKontextSekce(aiContext: string | null | undefined): string {
  const text = aiContext?.trim()
  if (!text) return ''
  return `\n\nFIREMNÍ KONTEXT (jak tahle firma funguje — řiď se tím jako zkušená kolegyně):\n${text.slice(0, AI_CONTEXT_MAX)}`
}
