import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'

// Obnoví odkaz na ICS kalendář — dřív vydané odkazy (např. v cizím Google
// kalendáři) přestanou platit.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await orgPrisma(session.user.orgId).user.update({
    where: { id: session.user.id },
    data: { calendarTokenVersion: { increment: 1 } },
  })
  return NextResponse.json({ ok: true })
}
