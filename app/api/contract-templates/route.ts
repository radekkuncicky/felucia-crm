import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { sanitizeFullDocumentHtml } from '@/lib/sanitizeHtml'
import { getPlanLimits } from '@/lib/planLimits'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const templates = await db.contractTemplate.findMany({
    where: { orgId },
    orderBy: { nazev: 'asc' },
  })
  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const { nazev, popis, obsah } = await req.json()
  if (!nazev) return NextResponse.json({ error: 'nazev required' }, { status: 400 })

  const limits = getPlanLimits(session.user.plan ?? 'STARTER')
  if (limits.maxContractTemplates !== Infinity) {
    const count = await db.contractTemplate.count({ where: { orgId } })
    if (count >= limits.maxContractTemplates) {
      return NextResponse.json(
        { error: `Dosáhli jste limitu ${limits.maxContractTemplates} smluvních šablon pro váš plán.`, code: 'PLAN_LIMIT_REACHED' },
        { status: 403 },
      )
    }
  }

  const tpl = await db.contractTemplate.create({
    data: {
      orgId,
      nazev,
      popis: typeof popis === 'string' && popis.trim() ? popis.trim() : null,
      obsah: sanitizeFullDocumentHtml(obsah ?? ''),
    },
  })
  return NextResponse.json(tpl, { status: 201 })
}
