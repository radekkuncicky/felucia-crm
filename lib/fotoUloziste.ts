import { randomUUID } from 'crypto'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { checkImageUpload, safeUploadPath } from './uploadSafety'

/**
 * Ukládání fotek k OP na disk (public/uploads/<orgId>/<dealId>/<uuid>.<ext>).
 * Společné pro web (app/api/deals/[id]/photos) i appku Sales. Typ se ověřuje
 * podle obsahu (magic bytes), ne podle hlavičky.
 */
export const FOTO_MAX_BYTES = 10 * 1024 * 1024

export type UlozeniFotky =
  | { ok: true; cesta: string }
  | { ok: false; status: 413 | 415; error: string }

export async function ulozFotkuOp(orgId: string, dealId: string, buffer: Buffer): Promise<UlozeniFotky> {
  if (buffer.length > FOTO_MAX_BYTES) return { ok: false, status: 413, error: 'Soubor je příliš velký. Maximum je 10 MB.' }
  const img = checkImageUpload(buffer, ['png', 'jpg', 'gif', 'webp', 'heic'])
  if (!img) return { ok: false, status: 415, error: 'Soubor není podporovaný obrázek' }
  const dir = path.join(process.cwd(), 'public', 'uploads', orgId, dealId)
  await mkdir(dir, { recursive: true })
  const filename = `${randomUUID()}.${img.ext}`
  await writeFile(path.join(dir, filename), buffer)
  return { ok: true, cesta: `/uploads/${orgId}/${dealId}/${filename}` }
}

/** Smaže soubor fotky (chybějící soubor nevadí) */
export async function smazSouborFotky(cesta: string): Promise<void> {
  const abs = safeUploadPath(cesta)
  if (!abs) return
  await unlink(abs).catch(() => {})
}
