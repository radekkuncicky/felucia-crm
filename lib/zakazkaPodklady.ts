import { writeFile, mkdir, unlink } from 'fs/promises'
import { safeUploadPath, checkDocumentUpload } from './uploadSafety'
import { join } from 'path'

/**
 * Podklady zakázky (soubory od manažera pro techniky) — úložiště na disku
 * pod public/uploads/zakazky/<zakazkaId>/ stejně jako fotky z mobilní appky.
 * Cesty jsou veřejné bez auth (obscurní CUID + timestamp), viz middleware.ts.
 */

export const PODKLAD_MAX_SIZE = 25 * 1024 * 1024 // 25 MB

/** Bezpečný název souboru: bez diakritiky, jen [A-Za-z0-9._-], max 80 znaků, zachová příponu */
export function sanitizeNazevSouboru(nazev: string): string {
  const bezDiakritiky = nazev.normalize('NFD').replace(/[̀-ͯ]/g, '')
  const clean = bezDiakritiky.replace(/[^A-Za-z0-9._-]+/g, '_').replace(/^[._]+/, '')
  if (!clean) return 'soubor'
  if (clean.length <= 80) return clean
  const dot = clean.lastIndexOf('.')
  const ext = dot > 0 ? clean.slice(dot).slice(0, 10) : ''
  return clean.slice(0, 80 - ext.length) + ext
}

/** Soubor neprošel kontrolou typu (přípona mimo whitelist nebo obsah neodpovídá příponě) */
export class PodkladTypeError extends Error {
  constructor() { super('Nepodporovaný typ souboru') }
}

/**
 * Zapíše soubor na disk a vrátí relativní URL (/uploads/zakazky/…) pro DB.
 * Typ se ověřuje podle obsahu (magic bytes) + whitelistu přípon — /uploads
 * je veřejné a Next servíruje podle přípony, takže .html/.svg by běžely
 * v originu aplikace (XSS). Přípona v názvu se přepíše na tu ověřenou.
 */
export async function ulozitPodklad(zakazkaId: string, buffer: Buffer, nazev: string): Promise<string> {
  const check = checkDocumentUpload(buffer, nazev)
  if (!check) throw new PodkladTypeError()
  const base = sanitizeNazevSouboru(nazev).replace(/\.[^.]*$/, '') || 'soubor'
  const filename = `dok_${Date.now()}_${base}.${check.ext}`
  const dir = join(process.cwd(), 'public', 'uploads', 'zakazky', zakazkaId)
  await mkdir(dir, { recursive: true })
  await writeFile(join(dir, filename), buffer)
  return `/uploads/zakazky/${zakazkaId}/${filename}`
}

/** Rozloží data: URI (legacy formát podkladů v DB) na mime + buffer; null pokud to není data: URI */
export function parseDataUri(url: string): { mime: string; buffer: Buffer } | null {
  const m = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]*)$/.exec(url)
  if (!m) return null
  return { mime: m[1] || 'application/octet-stream', buffer: Buffer.from(m[2], 'base64') }
}

/** Smaže soubor podkladu z disku (jen pro relativní /uploads/ cesty, chyby ignoruje) */
export async function smazatPodkladSoubor(url: string): Promise<void> {
  const abs = safeUploadPath(url, '/uploads/zakazky/')
  if (!abs) return
  await unlink(abs).catch(() => {})
}
