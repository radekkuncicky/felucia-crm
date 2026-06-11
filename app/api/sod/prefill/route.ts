import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { predmetDilaByTechnologie, kategorieByTechnologie } from '@/lib/sodHelpers'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { searchParams } = new URL(req.url)
  const dealId = searchParams.get('dealId')
  if (!dealId) return NextResponse.json({ error: 'dealId je povinný' }, { status: 400 })

  const deal = await db.deal.findFirst({
    where: { id: dealId, orgId },
    include: {
      client: true,
      quotes: {
        where: { aktivni: true },
        include: { items: true },
        take: 1,
      },
    },
  })

  if (!deal) return NextResponse.json({ error: 'Deal nenalezen' }, { status: 404 })

  const aktivniQuote = deal.quotes[0]
  const cenaBezDph = aktivniQuote?.items.reduce((s, i) =>
    s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number(i.sleva ?? 0) / 100), 0) ?? 0
  const dphSazba = aktivniQuote?.dphSazba ?? deal.dphSazba ?? 21
  const cenaSDph = cenaBezDph * (1 + dphSazba / 100)

  const klientJmeno = `${deal.client.jmeno} ${deal.client.prijmeni}`.trim()
  const klientAdresa = [deal.client.ulice, deal.client.psc, deal.client.mesto].filter(Boolean).join(', ')

  return NextResponse.json({
    klientJmeno,
    klientAdresa: klientAdresa || null,
    klientEmail: deal.client.email ?? null,
    klientTelefon: deal.client.telefon ?? null,
    klientIco: deal.client.ico ?? null,
    klientDic: deal.client.dic ?? null,
    kontaktniOsoba: deal.kontaktniOsoba ?? klientJmeno,
    kontaktniTelefon: deal.kontaktniTelefon ?? deal.client.telefon ?? null,
    predmetDila: predmetDilaByTechnologie(deal.technologie ?? ''),
    adresaDila: deal.adresaDila ?? klientAdresa ?? null,
    zalohaKategorie: kategorieByTechnologie(deal.technologie ?? ''),
    cenaBezDph: Math.round(cenaBezDph),
    cenaSDph: Math.round(cenaSDph),
    dphSazba,
    zalohaKc: Math.round(cenaSDph * 0.70),
    zalohaSplatnost: 14,
  })
}
