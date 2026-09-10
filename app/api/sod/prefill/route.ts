import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { predmetDilaByTechnologie, kategorieByTechnologie } from '@/lib/sodHelpers'
import { prisma } from '@/lib/prisma'

export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
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

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { prilohaVopPath: true, prilohaVzspPath: true, prilohaCenikPath: true },
  })

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
    realizaceOd: deal.terminRealizace ? deal.terminRealizace.toISOString().slice(0, 10) : '',
    realizaceDo: deal.terminPrevzeti ? deal.terminPrevzeti.toISOString().slice(0, 10) : '',
    prilohy: {
      hasVop: !!org?.prilohaVopPath,
      hasVzsp: !!org?.prilohaVzspPath,
      hasCenik: !!org?.prilohaCenikPath,
    },
  })
}
