import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getPerms, forbidden } from '@/lib/permissions'
import { canAccessZakazka } from '@/lib/zakazkyHelpers'
import { loadObjednavkaFull, renderObjednavkaPdf } from '@/lib/objednavkaDokument'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (perms.sklad === 'ZADNY') return forbidden()

  const orgId = session.user.orgId
  const o = await loadObjednavkaFull(orgId, params.id)
  if (!o) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (o.zakazkaId && !(await canAccessZakazka(session.user, perms, o.zakazkaId))) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const pdf = await renderObjednavkaPdf(orgId, session.user.plan, o, perms.financeNakupky)
    return new NextResponse(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${o.cislo}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[objednavka-pdf] error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
