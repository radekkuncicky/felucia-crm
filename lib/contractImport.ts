import mammoth from 'mammoth'
import { sanitizeFullDocumentHtml } from './sanitizeHtml'

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024 // 5 MB

export type ImportResult = { html: string } | { error: string }

/**
 * Převede nahraný soubor šablony smlouvy na sanitizované HTML.
 * .docx přes mammoth, .html/.htm raw. Neukládá — jen konvertuje a čistí.
 */
export async function importContractFile(filename: string, buf: Buffer): Promise<ImportResult> {
  const name = filename.toLowerCase()
  let rawHtml: string

  if (name.endsWith('.docx')) {
    try {
      const result = await mammoth.convertToHtml({ buffer: buf })
      rawHtml = result.value
    } catch {
      return { error: 'Soubor .docx se nepodařilo přečíst.' }
    }
  } else if (name.endsWith('.html') || name.endsWith('.htm')) {
    rawHtml = buf.toString('utf-8')
  } else {
    return { error: 'Podporované formáty jsou .docx, .html.' }
  }

  const html = sanitizeFullDocumentHtml(rawHtml)
  if (!html.trim()) return { error: 'Soubor neobsahuje žádný použitelný text.' }
  return { html }
}
