import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { createSodFromDeal } from '@/lib/sodCreate'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const sods = await db.sod.findMany({
    where: { orgId },
    include: { deal: { include: { client: true } } },
    orderBy: { vytvoreno: 'desc' },
  })

  return NextResponse.json(sods)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!(getPerms(session.user).obchod)) return forbidden()
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const body = await req.json()
  const { dealId, templateId, typ, overrides: rawOverrides, ...rest } = body
  // overrides: holý placeholder -> hodnota (ruční doplnění prázdných polí z modalu)
  const overrides: Record<string, string> =
    rawOverrides && typeof rawOverrides === 'object' ? rawOverrides : {}

  if (!dealId) return NextResponse.json({ error: 'dealId je povinný' }, { status: 400 })
  if (!templateId && !typ) return NextResponse.json({ error: 'templateId nebo typ je povinný' }, { status: 400 })

  const deal = await db.deal.findFirst({ where: { id: dealId, orgId } })
  if (!deal) return NextResponse.json({ error: 'Deal nenalezen' }, { status: 404 })

  const result = await createSodFromDeal(db, orgId, { dealId, templateId, typ, overrides, form: rest })
  if ('error' in result) return NextResponse.json({ error: result.error }, { status: 404 })

  return NextResponse.json(result.sod, { status: 201 })
}
