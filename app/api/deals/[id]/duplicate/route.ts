import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { StavDealu } from '@prisma/client'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const userId = session.user.id

  const deal = await prisma.deal.findFirst({
    where: { id: params.id, orgId },
    include: { quoteItems: true },
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const newDeal = await prisma.deal.create({
    data: {
      orgId,
      clientId: deal.clientId,
      userId,
      technologie: deal.technologie,
      stav: StavDealu.NOVY,
      predmet: deal.predmet ? `${deal.predmet} (kopie)` : 'Kopie',
      hodnotaZalohy: deal.hodnotaZalohy,
      adresaDila: deal.adresaDila,
      kontaktniOsoba: deal.kontaktniOsoba,
      kontaktniTelefon: deal.kontaktniTelefon,
      poznamky: deal.poznamky,
      quoteItems: {
        create: deal.quoteItems.map((item) => ({
          productId: item.productId,
          nazev: item.nazev,
          mnozstvi: item.mnozstvi,
          cenaZaKus: item.cenaZaKus,
          poznamky: item.poznamky,
        })),
      },
    },
  })

  return NextResponse.json(newDeal, { status: 201 })
}
