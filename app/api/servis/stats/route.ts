import { getPlanLimits } from '@/lib/planLimits'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

// Čte mobilní app. Vrací jen počty, takže shim stavů netřeba (filtry už nové).
// TODO(servis-refactor): zkontrolovat při úpravě app.
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { orgId, plan } = session.user
  const db = orgPrisma(orgId)
  if (!getPlanLimits(plan).hasServiceModule) return NextResponse.json({ error: 'Vyžadován plán Professional nebo Enterprise' }, { status: 403 })

  const now = new Date()
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

  const [
    zarizeniCount,
    aktivniKontrakty,
    nadchazejiNavstevy,
    presleNavstevy,
    dokonceneNavstevy,
  ] = await Promise.all([
    db.zarizeni.count({ where: { orgId, aktivni: true } }),
    db.servisniKontrakt.count({ where: { orgId, aktivni: true } }),
    db.servisniZakazka.count({
      where: { orgId, stav: 'NAPLANOVANA', planovanyTermin: { lte: thirtyDaysFromNow, gte: now } },
    }),
    db.servisniZakazka.count({
      where: { orgId, stav: 'NAPLANOVANA', planovanyTermin: { lt: now } },
    }),
    db.servisniZakazka.count({
      where: { orgId, stav: 'DOKONCENA' },
    }),
  ])

  return NextResponse.json({
    zarizeniCount,
    aktivniKontrakty,
    nadchazejiNavstevy,
    presleNavstevy,
    dokonceneNavstevy,
  })
}
