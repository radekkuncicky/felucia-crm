import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { diktatScope, NEZPRACOVANY_WHERE } from '@/lib/diktat'

/** GET /api/diktat/pocet — počet nezpracovaných diktátů (odznak v menu) */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  if (!perms.obchod) return NextResponse.json({ pocet: 0 })
  const orgId = session.user.orgId
  const pocet = await orgPrisma(orgId).activity.count({
    where: { orgId, ...NEZPRACOVANY_WHERE, ...diktatScope(perms, session.user.id) },
  })
  return NextResponse.json({ pocet })
}
