import { NextResponse } from 'next/server'
import { orgPrisma } from '@/lib/orgPrisma'
import { getMobileOrWebSession, requireObchodnikOrAdmin } from '@/lib/mobile-helpers'
import { buildSodPdf } from '@/lib/sodPdf'

// GET /api/mobile/obchod/sod/[id]/pdf — PDF smlouvy pro náhled v appce
// (klient si ji projde na telefonu obchodníka před podpisem na místě)
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const session = await getMobileOrWebSession(req)
  const authErr = requireObchodnikOrAdmin(session)
  if (authErr) return authErr

  const orgId = session!.user.orgId
  const sod = await orgPrisma(orgId).sod.findFirst({
    where: { id: params.id },
    select: { id: true },
  })
  if (!sod) return NextResponse.json({ error: 'Smlouva nenalezena' }, { status: 404 })

  try {
    const result = await buildSodPdf(sod.id, orgId)
    if (!result) return NextResponse.json({ error: 'Smlouva nenalezena' }, { status: 404 })
    return new Response(result.pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${result.cislo}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[mobile-sod-pdf] error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF' }, { status: 500 })
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 })
}
