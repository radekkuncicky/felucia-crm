import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { parseZaregulovaniVzt } from '@/lib/zaregulovaniVztData'
import { vytvoritZaregulovaniVzt } from '@/lib/zaregulovaniVzt'

/**
 * POST — vygeneruje Protokol o zaregulování VZT (PDF), uloží ho do Podkladů
 * zakázky a vrátí ke stažení. Smí každý s přístupem k zakázce (měří technik).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) return forbidden()

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Neplatná data' }, { status: 400 }) }
  const vstup = parseZaregulovaniVzt(body)
  if (typeof vstup === 'string') return NextResponse.json({ error: vstup }, { status: 400 })

  const out = await vytvoritZaregulovaniVzt(session.user.orgId, String(session.user.plan), session.user.id, params.id, vstup)
  if (!out) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(out.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'X-Dokument-Id': out.dokument.id,
    },
  })
}
