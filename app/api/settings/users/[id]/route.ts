import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Role } from '@prisma/client'
import { checkUserLimit } from '@/lib/checkPlanLimit'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const user = await db.user.findFirst({ where: { id: params.id, orgId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()

  // Reaktivace zabírá licenci stejně jako založení nového uživatele, takže
  // musí projít stejným limitem — jinak by deaktivace + založení + reaktivace
  // limit plánu obešly.
  if (body.aktivni === true && !user.aktivni && !(await checkUserLimit(orgId))) {
    return NextResponse.json({
      error: 'PLAN_LIMIT_REACHED',
      message: 'Dosáhli jste limitu uživatelů pro váš plán.',
      upgradeUrl: '/settings/billing',
    }, { status: 403 })
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: {
      role: body.role ? (body.role as Role) : user.role,
      aktivni: body.aktivni !== undefined ? body.aktivni : user.aktivni,
      jmeno: body.jmeno ?? user.jmeno,
      serviceAccess: body.serviceAccess !== undefined ? body.serviceAccess : user.serviceAccess,
      podepisujeSmlouvy: body.podepisujeSmlouvy !== undefined ? body.podepisujeSmlouvy : user.podepisujeSmlouvy,
    },
    select: { id: true, jmeno: true, email: true, role: true, aktivni: true, serviceAccess: true, podepisujeSmlouvy: true },
  })
  return NextResponse.json(updated)
}
