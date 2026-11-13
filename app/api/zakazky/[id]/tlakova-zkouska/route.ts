import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { parseEtapaId } from '@/lib/zakazkaProtokolPdf'
import { parseTlakovaZkouska } from '@/lib/tlakovaZkouskaData'
import { vytvoritTlakovouZkousku } from '@/lib/tlakovaZkouska'

/**
 * POST — vygeneruje Protokol o tlakové zkoušce (PDF), uloží ho u zakázky
 * (volitelně k etapě) a vrátí ke stažení. Smí každý s přístupem k zakázce (zkoušku dělá technik).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessZakazka(session.user, getPerms(session.user), params.id))) return forbidden()

  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Neplatná data' }, { status: 400 }) }
  const vstup = parseTlakovaZkouska(body)
  if (typeof vstup === 'string') return NextResponse.json({ error: vstup }, { status: 400 })
  const etapaId = parseEtapaId(body)
  if (etapaId === false) return NextResponse.json({ error: 'Neplatná etapa' }, { status: 400 })

  const out = await vytvoritTlakovouZkousku(session.user.orgId, String(session.user.plan), session.user.id, params.id, vstup, etapaId)
  if (!out) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(new Uint8Array(out.pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${out.filename}"`,
      'X-Dokument-Id': out.dokument.id,
    },
  })
}
