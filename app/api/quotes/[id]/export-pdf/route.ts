import { getServerSession } from 'next-auth'
import { canAccessQuote } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { buildPdfFilename } from '@/lib/quoteKod'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(await canAccessQuote(session.user, getPerms(session.user), params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const [quote, org] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id, deal: { orgId } },
      select: {
        id: true,
        kod: true,
        deal: {
          select: {
            kod: true,
            technologie: true,
            client: { select: { jmeno: true, prijmeni: true } },
          },
        },
      },
    }),
    db.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
  ])

  if (!quote) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const pdf = await renderQuotePdf(params.id, orgId, org?.plan ?? 'STARTER')

    const filename = buildPdfFilename({
      clientJmeno: quote.deal.client.jmeno,
      clientPrijmeni: quote.deal.client.prijmeni,
      quoteKod: quote.kod ?? null,
      dealKod: quote.deal.kod,
      technologie: quote.deal.technologie,
    })

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('PDF export error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
