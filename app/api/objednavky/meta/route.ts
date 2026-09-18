import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'
import { isOrgEmailConfigured } from '@/lib/email'

/** Co smí aktuální uživatel s objednávkami + jestli jde odesílat e-mailem (pro klientské panely). */
export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const perms = getPerms(session.user)
  return NextResponse.json({
    canEdit: perms.sklad === 'PLNY',
    showNakupky: perms.financeNakupky,
    emailConfigured: await isOrgEmailConfigured(session.user.orgId),
  })
}
