import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { toLegacyNavsteva } from '@/lib/servisLegacy'

// Čte mobilní app. Vrací starý tvar (stav PLANOVANA, cisloNavstevy) přes legacy shim.
// TODO(servis-refactor): po úpravě app vracet nový tvar a shim sundat.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json([])

  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

  const navstevy = await db.servisniZakazka.findMany({
    where: {
      orgId,
      stav: 'NAPLANOVANA',
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

  return NextResponse.json(navstevy.map(toLegacyNavsteva))
}
