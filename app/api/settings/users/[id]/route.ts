import { getServerSession } from 'next-auth'
import { authOptions, invalidatePermsCache } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { checkUserLimit } from '@/lib/checkPlanLimit'
import { getPlanLimits } from '@/lib/planLimits'
import { logAction } from '@/lib/auditLog'
import { diffFromPreset, getPerms, isRoleName, parseOverrides, resolvePermissions } from '@/lib/permissions'

const USER_SELECT = { id: true, jmeno: true, email: true, role: true, aktivni: true, podepisujeSmlouvy: true, permissions: true } as const

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).spravaUzivatelu) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const user = await db.user.findFirst({ where: { id: params.id, orgId } })
  if (!user) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  const isSelf = user.id === session.user.id

  if (body.role !== undefined && !isRoleName(body.role)) {
    return NextResponse.json({ error: 'Neplatná role' }, { status: 400 })
  }
  if (isSelf && body.aktivni === false) {
    return NextResponse.json({ error: 'Nelze deaktivovat vlastní účet' }, { status: 400 })
  }

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

  const newRole = body.role ?? user.role

  // Přepisy oprávnění: jen na plánech s hasCustomPermissions; ukládáme jen rozdíly od presetu.
  // Při změně role bez explicitních přepisů se dosavadní přepisy zahodí — nová role = nový balíček.
  let permissions: Prisma.InputJsonValue | typeof Prisma.DbNull | undefined
  if (body.permissions !== undefined) {
    if (!getPlanLimits(session.user.plan).hasCustomPermissions) {
      return NextResponse.json({
        error: 'PLAN_LIMIT_REACHED',
        message: 'Úprava oprávnění nad rámec role je dostupná od plánu Standard.',
        upgradeUrl: '/settings/billing',
      }, { status: 403 })
    }
    const diff = diffFromPreset(newRole, parseOverrides(body.permissions))
    permissions = Object.keys(diff).length ? diff : Prisma.DbNull
  } else if (body.role !== undefined && body.role !== user.role) {
    permissions = Prisma.DbNull
  }

  // Pojistka proti zamčení: vlastní účet nesmí přijít o správu uživatelů
  if (isSelf && (body.role !== undefined || body.permissions !== undefined)) {
    const effective = resolvePermissions(newRole, permissions === Prisma.DbNull ? null : (permissions ?? user.permissions), session.user.plan)
    if (!effective.spravaUzivatelu) {
      return NextResponse.json({ error: 'Nemůžete si odebrat správu uživatelů — nastavil by vás někdo jiný' }, { status: 400 })
    }
  }

  const updated = await db.user.update({
    where: { id: params.id },
    data: {
      role: newRole,
      aktivni: body.aktivni !== undefined ? body.aktivni : user.aktivni,
      jmeno: body.jmeno ?? user.jmeno,
      podepisujeSmlouvy: body.podepisujeSmlouvy !== undefined ? body.podepisujeSmlouvy : user.podepisujeSmlouvy,
      ...(permissions !== undefined ? { permissions } : {}),
    },
    select: USER_SELECT,
  })

  // Role/oprávnění/aktivita se propisují do session přes cache snapshotu — zneplatnit hned
  invalidatePermsCache(params.id)

  if (body.role !== undefined || body.permissions !== undefined || body.aktivni !== undefined) {
    await logAction({
      orgId,
      userId: session.user.id,
      typAkce: 'UPDATE',
      typZaznamu: 'User',
      zaznamId: updated.id,
      zaznamNazev: `${updated.jmeno} (${updated.email})`,
      zmeny: {
        ...(body.role !== undefined ? { role: { z: user.role, na: updated.role } } : {}),
        ...(body.permissions !== undefined ? { permissions: updated.permissions } : {}),
        ...(body.aktivni !== undefined ? { aktivni: updated.aktivni } : {}),
      },
    })
  }

  return NextResponse.json(updated)
}
