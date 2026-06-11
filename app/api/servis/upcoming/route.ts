import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json([])

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const navstevy = await db.servisniNavsteva.findMany({
    where: {
      orgId,
      stav: 'PLANOVANA',
      planovanyTermin: { lte: thirtyDaysFromNow },
    },
    include: {
      kontrakt: {
        include: { klient: { select: { id: true, jmeno: true, prijmeni: true } } },
      },
      technik: { select: { id: true, jmeno: true } },
    },
    orderBy: { planovanyTermin: 'asc' },
  })

  return NextResponse.json(navstevy)
}
