import path from 'path'

/**
 * Bezpečná práce se soubory pod public/uploads.
 *
 * Cesty uložené v DB (logo org, fotky, dokumenty, přílohy) se nikdy nesmí
 * skládat do fs cesty naslepo — hodnota může přijít z klienta a `../` by
 * vedla mimo uploads (čtení .env, mazání buildů). Každé čtení/mazání podle
 * cesty z DB jde přes `safeUploadPath()`.
 *
 * Typ nahrávaného souboru se nikdy neurčuje z názvu ani z Content-Type
 * (obojí řídí klient) — přípona se odvozuje z magic bytes, viz `sniffFile()`.
 */

export const UPLOADS_ROOT = path.join(process.cwd(), 'public', 'uploads')

/**
 * Přeloží relativní URL (`/uploads/...`) na absolutní cestu na disku.
 * Vrátí null, pokud cesta nevede pod public/uploads (traversal, absolutní
 * cesta, data: URI, prázdný vstup) nebo nezačíná zadaným prefixem.
 */
export function safeUploadPath(rel: string | null | undefined, requiredPrefix = '/uploads/'): string | null {
  if (!rel || typeof rel !== 'string') return null
  if (!rel.startsWith('/uploads/') || !requiredPrefix.startsWith('/uploads/')) return null
  if (rel.includes('\0')) return null
  const resolved = path.resolve(UPLOADS_ROOT, '.' + rel.slice('/uploads'.length))
  if (resolved !== UPLOADS_ROOT && !resolved.startsWith(UPLOADS_ROOT + path.sep)) return null
  // Prefix se porovnává až po normalizaci — `/uploads/zakazky/a/../b/x` nesmí projít jako adresář `a`
  const prefixAbs = path.resolve(UPLOADS_ROOT, '.' + requiredPrefix.slice('/uploads'.length))
  const prefixDir = requiredPrefix.endsWith('/') ? prefixAbs + path.sep : prefixAbs
  if (!resolved.startsWith(prefixDir)) return null
  return resolved
}

/** Přípona z cesty (bez tečky, lowercase) nebo '' */
export function extOf(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

export type SniffedKind =
  | { ext: 'png' | 'jpg' | 'gif' | 'webp' | 'heic'; mime: string; kind: 'image' }
  | { ext: 'pdf'; mime: 'application/pdf'; kind: 'pdf' }
  | { ext: 'zip'; mime: 'application/zip'; kind: 'zip' }
  | { ext: 'ole'; mime: 'application/msword'; kind: 'ole' }

/** Rozpozná typ podle magic bytes. Vrátí null pro neznámý/textový obsah. */
export function sniffFile(buf: Buffer): SniffedKind | null {
  if (buf.length < 12) return null
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { ext: 'png', mime: 'image/png', kind: 'image' }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', mime: 'image/jpeg', kind: 'image' }
  if (buf.subarray(0, 4).toString('latin1') === 'GIF8') return { ext: 'gif', mime: 'image/gif', kind: 'image' }
  if (buf.subarray(0, 4).toString('latin1') === 'RIFF' && buf.subarray(8, 12).toString('latin1') === 'WEBP') return { ext: 'webp', mime: 'image/webp', kind: 'image' }
  if (buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1')
    if (/^(heic|heix|hevc|mif1|msf1|heim|heis|hevm|hevs)$/.test(brand)) return { ext: 'heic', mime: 'image/heic', kind: 'image' }
  }
  if (buf.subarray(0, 5).toString('latin1') === '%PDF-') return { ext: 'pdf', mime: 'application/pdf', kind: 'pdf' }
  if (buf[0] === 0x50 && buf[1] === 0x4b && (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)) return { ext: 'zip', mime: 'application/zip', kind: 'zip' }
  if (buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return { ext: 'ole', mime: 'application/msword', kind: 'ole' }
  return null
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'])

/**
 * Ověří obrázek: obsah musí být skutečný obrázek (magic bytes) z povoleného
 * seznamu. Vrátí bezpečnou příponu odvozenou z obsahu, ne z názvu.
 */
export function checkImageUpload(buf: Buffer, allowed: ReadonlyArray<'png' | 'jpg' | 'gif' | 'webp' | 'heic'> = ['png', 'jpg', 'gif', 'webp']): { ext: string; mime: string } | null {
  const s = sniffFile(buf)
  if (!s || s.kind !== 'image') return null
  if (!allowed.includes(s.ext)) return null
  return { ext: s.ext, mime: s.mime }
}

/** Ověří PDF podle hlavičky */
export function isPdf(buf: Buffer): boolean {
  return sniffFile(buf)?.kind === 'pdf'
}

/**
 * Přípony povolené pro obecné dokumenty (podklady zakázek, dokumenty org).
 * Záměrně bez html/htm/svg/xml/js/xhtml/mht — Next servíruje public/ podle
 * přípony a aktivní obsah by běžel v originu aplikace.
 */
export const DOCUMENT_EXTS: ReadonlySet<string> = new Set([
  'pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'heic',
  'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'odt', 'ods', 'odp',
  'txt', 'csv', 'rtf', 'zip', '7z', 'rar', 'dwg', 'dxf', 'step', 'stp',
  'mp4', 'mov', 'mp3', 'm4a', 'eml', 'msg', 'json',
])

/**
 * Ověří obecný dokument: přípona z whitelistu a tam, kde má formát magic
 * bytes, musí obsah odpovídat (obrázek/PDF/zip-based Office/OLE Office).
 * Vrátí bezpečnou příponu (pro obrázky a PDF podle obsahu).
 */
export function checkDocumentUpload(buf: Buffer, originalName: string): { ext: string } | null {
  const ext = extOf(originalName)
  if (!DOCUMENT_EXTS.has(ext)) return null
  const s = sniffFile(buf)
  if (IMAGE_EXTS.has(ext)) return s?.kind === 'image' ? { ext: s.ext } : null
  if (ext === 'pdf') return s?.kind === 'pdf' ? { ext: 'pdf' } : null
  if (['docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp', 'zip'].includes(ext)) return s?.kind === 'zip' ? { ext } : null
  if (['doc', 'xls', 'ppt', 'msg'].includes(ext)) return s?.kind === 'ole' ? { ext } : null
  // txt/csv/rtf/dwg/dxf/step/mp4/…: bez spolehlivého magic; nesmí to ale být rozpoznaný binární formát pod cizí příponou
  if (s) return null
  return { ext }
}

/**
 * Logo org / šablony: rastrový obrázek podle magic bytes, nebo SVG (text) bez
 * skriptů a event handlerů. SVG se z /uploads servíruje s CSP `sandbox` +
 * `default-src 'none'`, takže tohle je jen druhá vrstva.
 */
export function checkLogoUpload(buf: Buffer): { ext: string; mime: string } | null {
  const img = checkImageUpload(buf, ['png', 'jpg', 'gif', 'webp'])
  if (img) return img
  const head = buf.subarray(0, 2048).toString('utf8').replace(/^\uFEFF/, '').trimStart()
  if (!/^(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE svg[^>]*>\s*)?<svg[\s>]/i.test(head)) return null
  const text = buf.toString('utf8')
  if (/<\s*(script|foreignObject|iframe|object|embed|use)\b/i.test(text)) return null
  if (/\son[a-z]+\s*=/i.test(text) || /javascript:/i.test(text) || /<\s*a\b/i.test(text)) return null
  return { ext: 'svg', mime: 'image/svg+xml' }
}

/** data: URI obrázku (JSON fallback fotek z webu) — jen povolené typy a rozumná délka */
const DATA_IMAGE_RE = /^data:image\/(png|jpe?g|webp|heic|heif|gif);base64,[A-Za-z0-9+/=]+$/
export function isImageDataUri(value: unknown, maxBytes = 10 * 1024 * 1024): value is string {
  if (typeof value !== 'string') return false
  if (value.length > Math.ceil(maxBytes * 4 / 3) + 64) return false
  return DATA_IMAGE_RE.test(value)
}
