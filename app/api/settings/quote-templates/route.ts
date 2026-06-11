import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { orgPrisma } from '@/lib/orgPrisma'
import { NextResponse } from 'next/server'
import { getPlanLimits } from '@/lib/planLimits'

export async function GET() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const templates = await db.quoteTemplate.findMany({
    where: { orgId },
    include: { config: true, htmlTemplate: { select: { id: true, templateId: true, cssContent: true } } },
    orderBy: [{ isDefault: 'desc' }, { vytvoreno: 'asc' }],
  })

  return NextResponse.json(templates)
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  const db = orgPrisma(orgId)

  const org = await db.organization.findUnique({ where: { id: orgId }, select: { plan: true } })
  const limits = getPlanLimits(org?.plan ?? 'STARTER')

  // STANDARD+ může vytvářet šablony (dle limitu)
  if (!['STANDARD', 'PROFESSIONAL', 'ENTERPRISE'].includes(org?.plan ?? '')) {
    return NextResponse.json({ error: 'Tuto funkci vyžaduje plán Standard nebo vyšší.' }, { status: 403 })
  }

  const body = await req.json()
  const { nazev, typ = 'CUSTOM_HTML' } = body

  if (!nazev) return NextResponse.json({ error: 'Název je povinný' }, { status: 400 })

  // Počet šablon
  const count = await db.quoteTemplate.count({
    where: { orgId, isSystem: false, typ: { in: ['BASE', 'STANDARD', 'CUSTOM_HTML'] } },
  })
  if (limits.maxQuoteTemplates !== Infinity && count >= limits.maxQuoteTemplates) {
    return NextResponse.json({ error: 'Dosažen limit šablon pro váš plán.', code: 'PLAN_LIMIT_REACHED' }, { status: 403 })
  }

  const template = await db.quoteTemplate.create({
    data: {
      orgId,
      nazev,
      typ,
      planRequired: 'PROFESSIONAL',
      isDefault: false,
      config: { create: { primaryColor: '#4CAF50' } },
      ...(typ === 'CUSTOM_HTML'
        ? { htmlTemplate: { create: { htmlContent: '' } } }
        : {}),
    },
    include: { config: true, htmlTemplate: true },
  })

  return NextResponse.json(template, { status: 201 })
}

