import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { renderQuoteHtml } from '@/lib/quoteRenderer'

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const [quote, org] = await Promise.all([
    prisma.quote.findFirst({
      where: { id: params.id, deal: { orgId } },
      select: { id: true },
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
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
