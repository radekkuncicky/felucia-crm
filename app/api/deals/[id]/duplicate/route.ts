import { getServerSession } from 'next-auth'
import { canAccessDeal } from '@/lib/zakazkyHelpers'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { StavDealu } from '@prisma/client'
import { checkDealLimit } from '@/lib/checkPlanLimit'
import { generateDealKod } from '@/lib/dealKod'
import { createWithUniqueKod } from '@/lib/uniqueKod'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.obchod) return forbidden()
  if (!(await canAccessDeal(session.user, perms, params.id))) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const userId = session.user.id

  const deal = await db.deal.findFirst({
    where: { id: params.id, orgId },
    include: { quoteItems: true },
  })
  if (!deal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Kopie je nový OP — stejná pravidla jako POST /api/deals (limit plánu, číslo z řady)
  if (!(await checkDealLimit(orgId))) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu obchodních případů pro váš plán. Vyšší plán má neomezený počet.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const newDeal = await createWithUniqueKod(
    () => generateDealKod(orgId),
    kod => db.deal.create({
    data: {
      orgId,
      clientId: deal.clientId,
      userId,
      kod,
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
  }),
  )

  return NextResponse.json(newDeal, { status: 201 })
}
