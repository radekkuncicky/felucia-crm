import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms, forbidden, dealScopeWhere } from '@/lib/permissions'
import { najdiVolajiciho } from '@/lib/zapisHovoru'

// GET ?tel= — kdo volá: klienti (s otevřenými OP) a otevřené leady se shodným číslem
export async function GET(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  const scope = dealScopeWhere(perms, session.user.id)
  if (!scope) return forbidden()

  const tel = new URL(req.url).searchParams.get('tel') ?? ''
  const orgId = session.user.orgId
  const shody = await najdiVolajiciho(orgPrisma(orgId), orgId, tel, scope)
  // Leady jsou od plánu STANDARD
  return NextResponse.json(session.user.plan === 'STARTER' ? { ...shody, leady: [] } : shody)
}
