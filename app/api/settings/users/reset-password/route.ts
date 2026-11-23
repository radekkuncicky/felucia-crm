import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'
import { logAction } from '@/lib/auditLog'
import { posliPozvanku, posliResetOdSpravce } from '@/lib/userInvite'

// POST /api/settings/users/reset-password  { userId }
// Kdo se ještě nepřihlásil → pozvánka znovu (7 dní, text pozvánky).
// Kdo už se přihlásil → odkaz na nové heslo od správce (24 h).
export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId } = await req.json()
  if (typeof userId !== 'string' || !userId) return NextResponse.json({ error: 'userId je povinný' }, { status: 400 })

  const orgId = session.user.orgId
  const db = orgPrisma(orgId)
  const user = await db.user.findFirst({
    where: { id: userId, orgId, aktivni: true },
    select: { id: true, email: true, jmeno: true, role: true, lastLoginAt: true },
  })
  if (!user) return NextResponse.json({ error: 'Uživatel nenalezen' }, { status: 404 })

  const pozvanka = !user.lastLoginAt
  const vysledek = pozvanka
    ? await posliPozvanku(db, { orgId, user, kdoZve: session.user.jmeno })
    : await posliResetOdSpravce(db, { orgId, user, kdo: session.user.jmeno })

  await logAction({
    orgId, userId: session.user.id, typAkce: 'UPDATE', typZaznamu: 'User',
    zaznamId: user.id, zaznamNazev: `${user.jmeno} (${user.email})`,
    zmeny: { akce: pozvanka ? 'pozvanka-znovu' : 'reset-hesla-od-spravce', emailOdeslan: vysledek.emailSent },
  })

  // resetUrl: zpětná kompatibilita se staršími klienty
  return NextResponse.json({ ok: true, pozvanka, emailSent: vysledek.emailSent, emailError: vysledek.emailError, resetUrl: vysledek.url })
}
