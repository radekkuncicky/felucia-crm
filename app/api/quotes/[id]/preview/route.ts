import { getServerSession } from 'next-auth'
import { canAccessQuote } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { renderQuoteHtml } from '@/lib/quoteRenderer'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessQuote(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const [quote, org] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id, deal: { orgId } },
      select: { id: true },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
  ])

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const html = await renderQuoteHtml(params.id, orgId, org?.plan ?? 'STARTER')
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  } catch (err) {
    console.error('Preview error:', err)
    return NextResponse.json({ error: 'Chyba při generování náhledu.' }, { status: 500 })
  }
}
