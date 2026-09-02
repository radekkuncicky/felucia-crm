import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { checkQuoteTemplateLimit } from '@/lib/checkPlanLimit'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const tpl = await db.quoteTemplate.findFirst({ where: { id: params.id, orgId } })
  if (!tpl) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (!(await checkQuoteTemplateLimit(orgId))) {
    return NextResponse.json({ error: 'Dosažen limit šablon pro váš plán.', code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
  }

  // Kopie je vždy vlastní (nesystémová, ne výchozí) šablona, kterou pak uživatel upraví.
  const copy = await db.quoteTemplate.create({
    data: {
      orgId,
      nazev: `${tpl.nazev} (kopie)`,
      typ: tpl.typ,
      planRequired: tpl.planRequired,
      popis: tpl.popis,
      technologie: tpl.technologie,
      polozky: tpl.polozky ?? [],
      isDefault: false,
      isSystem: false,
    },
  })

  return NextResponse.json(copy, { status: 201 })
}
