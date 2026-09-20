import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPerms } from '@/lib/permissions'

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).nastaveniOrg) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const updated = await db.organization.update({
    where: { id: orgId },
    data: {
      nazev: body.nazev || undefined,
      ico: body.ico || null,
      dic: body.dic || null,
      sidlo: body.sidlo || null,
      telefon: body.telefon || null,
      email: body.email || null,
      web: body.web || null,
      // logo/logoBw se z body nepřebírají — nastavují je výhradně upload routes
      // (company/logo, company/logo-bw); hodnota z klienta by šla do fs cesty.
    },
  })
  return NextResponse.json(updated)
}
