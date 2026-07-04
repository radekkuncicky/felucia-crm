import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { generateServisFakturaHtml } from '@/lib/servisFakturaHtml'
import { computeVyuctovani } from '@/lib/servisVyuctovani'
import { generatePdf } from '@/lib/pdf'
import { buildDokumentChrome } from '@/lib/dokumentyChrome'
import { orgLogoDataUrl } from '@/lib/quoteRenderer'

// GET /api/servis/zakazky/[id]/faktura - PDF podklad pro fakturaci (hardened cesta).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const zakazka = await db.servisniZakazka.findFirst({
    where: { id: params.id, orgId },
    include: {
      klient: { select: { jmeno: true, prijmeni: true, ulice: true, mesto: true, psc: true } },
      polozky: { orderBy: { poradi: 'asc' } },
    },
  })
  if (!zakazka) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const org = await db.organization.findUnique({
    where: { id: orgId },
    select: { nazev: true, sidlo: true, ico: true, email: true, telefon: true, logo: true },
  })
  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 })

  try {
    const souhrn = computeVyuctovani(zakazka.polozky as never)
    const html = generateServisFakturaHtml(
      zakazka,
      zakazka.klient,
      { ...org, logo: orgLogoDataUrl(org.logo) },
      souhrn,
    )

    const chrome = await buildDokumentChrome(orgId, plan)
    const pdf = await generatePdf(html, chrome)

    const cislo = zakazka.cislo ?? zakazka.id.slice(0, 8).toUpperCase()
    return new Response(pdf as unknown as BodyInit, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="podklad-faktura-${cislo}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Faktura podklad PDF error:', err)
    return NextResponse.json({ error: 'Chyba při generování PDF.' }, { status: 500 })
  }
}
