import { sanitizeFullDocumentHtml } from './sanitizeHtml'

// Sdílený HTML render textu smlouvy (sod.textSmlouvy) pro PDF i DOCX,
// aby se obě výstupní cesty nerozcházely. textSmlouvy je buď HTML
// (uloženo ze šablony / ručně), nebo prostý text.

export const SOD_CONTRACT_STYLES = `
  body { font-family: 'Times New Roman', serif; font-size: 11pt; line-height: 1.7; color: #000; }
  h1 { font-size: 14pt; font-weight: bold; text-align: center; margin: 1.2em 0 0.8em; }
  h2 { font-size: 12pt; font-weight: bold; margin: 1em 0 0.5em; }
  h3 { font-size: 11pt; font-weight: bold; margin: 0.8em 0 0.4em; }
  p { margin: 0 0 0.7em; }
  ul, ol { padding-left: 1.5em; margin: 0.4em 0; }
  li { margin: 0.2em 0; }
  strong { font-weight: bold; }
  em { font-style: italic; }
  u { text-decoration: underline; }
`

function wrap(bodyHtml: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SOD_CONTRACT_STYLES}</style></head><body>${bodyHtml}</body></html>`
}

function textToHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const paragraphs = escaped
    .split(/\n\n+/)
    .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('\n')
  return wrap(paragraphs)
}

/** Vrátí kompletní HTML dokument z uloženého textSmlouvy (HTML i prostý text). */
export function renderSodContractHtml(textSmlouvy: string): string {
  const trimmed = textSmlouvy.trimStart()
  if (!trimmed.startsWith('<')) return textToHtml(textSmlouvy)

  // Kompletní HTML dokument (šablona se svým vlastním <style>) — vrátit přímo,
  // jinak by wrap() vnořil celý dokument do <body> a přebil by CSS.
  if (/^<!doctype|^<html/i.test(trimmed)) {
    return sanitizeFullDocumentHtml(textSmlouvy)
  }

  // HTML fragment (legacy šablony bez DOCTYPE/html tagu) — obalit standardním wrap.
  return wrap(sanitizeFullDocumentHtml(textSmlouvy))
}
