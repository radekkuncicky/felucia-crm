import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { renderQuotePdf } from '@/lib/quoteRenderer'
import { buildPdfFilename } from '@/lib/quoteKod'

// GET /api/mobile/obchod/nabidka/[id]/pdf — PDF pro náhled v appce
// (inline, appka ho zobrazí ve WebView / share sheetu)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const orgId = session!.user.orgId
  const db = orgPrisma(orgId)

  const [quote, org] = await Promise.all([
    db.quote.findFirst({
      where: { id: params.id },
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
  if (!quote) return NextResponse.json({ error: 'Nabídka nenalezena' }, { status: 404 })

  try {
    const pdf = await renderQuotePdf(quote.id, orgId, org?.plan ?? 'STARTER')
    const filename = buildPdfFilename({
      clientJmeno: quote.deal.client.jmeno,
      clientPrijmeni: quote.deal.client.prijmeni,
      quoteKod: quote.kod,
      dealKod: quote.deal.kod,
      technologie: quote.deal.technologie,
    })
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${filename}"`,
      },
    })
  } catch (err) {
    console.error('[mobile-nabidka-pdf] error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
