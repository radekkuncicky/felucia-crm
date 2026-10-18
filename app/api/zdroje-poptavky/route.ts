import { getServerSession } from 'next-auth'
import { NextResponse } from 'next/server'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { nactiZdroje } from '@/lib/zdrojPoptavky'

/** Číselník zdrojů poptávky org (pro výběry v leadu, OP a hovoru). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  return NextResponse.json(await nactiZdroje(orgPrisma(orgId), orgId))
}
