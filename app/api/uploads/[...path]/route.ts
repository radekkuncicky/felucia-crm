import { NextRequest, NextResponse } from 'next/server'
import { stat } from 'fs/promises'
import { createReadStream } from 'fs'
import { Readable } from 'stream'
import { extOf, safeUploadPath } from '@/lib/uploadSafety'
import { verifyUploadSignature } from '@/lib/uploadSign'
import { getMobileOrWebSession, canAccessZakazka, type MobileSession } from '@/lib/mobile-helpers'
import { orgPrisma } from '@/lib/orgPrisma'

/**
 * Servírování souborů z public/uploads s autorizací. Middleware sem přepisuje
 * všechny požadavky na /uploads/* (statické servírování Nextem by šlo bez
 * kontroly), takže tady je jediné místo, kde se rozhoduje, kdo co smí číst:
 *
 * - veřejné: loga org a šablon (branding na login stránce / v nabídkách)
 * - podepsaný odkaz (`?exp&sig`, lib/uploadSign.ts) — mobilní appky bez cookie
 * - session (web cookie nebo mobilní Bearer) + kontrola, že soubor patří org
 *   uživatele (u zakázek navíc rozsah oprávnění přes canAccessZakazka)
 */
export const dynamic = 'force-dynamic'

const MIME: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', heic: 'image/heic',
  svg: 'image/svg+xml', pdf: 'application/pdf',
  doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  odt: 'application/vnd.oasis.opendocument.text', ods: 'application/vnd.oasis.opendocument.spreadsheet',
  txt: 'text/plain; charset=utf-8', csv: 'text/csv; charset=utf-8', json: 'application/json', rtf: 'application/rtf',
  zip: 'application/zip', mp4: 'video/mp4', mov: 'video/quicktime', mp3: 'audio/mpeg', m4a: 'audio/mp4',
}
const INLINE_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic', 'pdf', 'svg', 'mp4', 'mov', 'mp3', 'm4a'])

/** Loga jsou branding — potřebná i bez přihlášení (login stránka tenanta) */
function isPublicUpload(rel: string): boolean {
  return /^\/uploads\/org\/[A-Za-z0-9_-]+\/logo(-bw)?\.[a-z0-9]+$/.test(rel) || rel.startsWith('/uploads/logos/')
}

/** Patří soubor do org uživatele (a smí ho podle rozsahu vidět)? */
async function sessionMayRead(session: MobileSession, rel: string): Promise<boolean> {
  const [, , area, second] = rel.split('/') // ['', 'uploads', area, second, ...]
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  switch (area) {
    case 'zakazky':
      return !!second && canAccessZakazka(session, second)
    case 'zamereni':
      return !!second && !!(await db.zamereni.findFirst({ where: { id: second }, select: { id: true } }))
    case 'org':
      return second === orgId
    case 'avatars': {
      const userId = (second ?? '').replace(/\.[a-z0-9]+$/i, '')
      return !!userId && !!(await db.user.findFirst({ where: { id: userId }, select: { id: true } }))
    }
    default:
      // /uploads/<orgId>/documents/… a /uploads/<orgId>/<dealId>/… (fotky OP)
      return area === orgId
  }
}

async function handle(req: NextRequest, params: { path: string[] }, headOnly: boolean) {
  const rel = '/uploads/' + params.path.map(decodeURIComponent).join('/')
  const abs = safeUploadPath(rel)
  if (!abs) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const ext = extOf(rel)
  const mime = MIME[ext]
  if (!mime) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  let allowed = isPublicUpload(rel)
  if (!allowed) {
    const q = req.nextUrl.searchParams
    allowed = verifyUploadSignature(rel, q.get('exp'), q.get('sig'))
  }
  if (!allowed) {
    const session = await getMobileOrWebSession(req)
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    allowed = await sessionMayRead(session, rel)
    if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let st: Awaited<ReturnType<typeof stat>>
  try {
    st = await stat(abs)
    if (!st.isFile()) throw new Error('not a file')
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const headers = new Headers({
    'Content-Type': mime,
    'Content-Length': String(st.size),
    'Last-Modified': st.mtime.toUTCString(),
    'Cache-Control': 'private, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
    'X-Robots-Tag': 'noindex, nofollow',
    // Nic z uploads nesmí běžet jako aktivní obsah v originu aplikace (PDF viewer bez sandbox)
    'Content-Security-Policy': ext === 'pdf' ? "default-src 'none'" : "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox",
  })
  if (!INLINE_EXT.has(ext)) headers.set('Content-Disposition', 'attachment')

  const ifModified = req.headers.get('if-modified-since')
  if (ifModified && new Date(ifModified).getTime() >= Math.floor(st.mtime.getTime() / 1000) * 1000) {
    return new NextResponse(null, { status: 304, headers })
  }
  if (headOnly) return new NextResponse(null, { status: 200, headers })

  const stream = Readable.toWeb(createReadStream(abs)) as ReadableStream
  return new NextResponse(stream, { status: 200, headers })
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(req, params, false)
}

export async function HEAD(req: NextRequest, { params }: { params: { path: string[] } }) {
  return handle(req, params, true)
}
