import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { odeslatSodFlow } from '@/lib/sodOdeslatFlow'
import { getPerms, forbidden } from '@/lib/permissions'

// Odeslání smlouvy k podpisu — celý tok (interní podpis zmocněnce, žádost
// o podpis, odeslání klientovi) žije v lib/sodOdeslatFlow.ts, sdílený s mobilem.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).obchod) return forbidden()

  const body = await req.json().catch(() => ({}))
  const vysledek = await odeslatSodFlow({
    orgId: session.user.orgId,
    userId: session.user.id,
    plan: session.user.plan,
    sodId: params.id,
    email: typeof body.email === 'string' ? body.email : undefined,
    telefon: typeof body.telefon === 'string' ? body.telefon : undefined,
    podpisSvg: typeof body.podpisSvg === 'string' ? body.podpisSvg : undefined,
    req,
  })
  if ('error' in vysledek) {
    return NextResponse.json({ error: vysledek.error }, { status: vysledek.status })
  }
  return NextResponse.json(vysledek)
}
