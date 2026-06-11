import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId

  const template = await prisma.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
    include: { config: true, htmlTemplate: true },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(template)
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = await prisma.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (template.isSystem) return NextResponse.json({ error: 'Systémové šablony nelze upravovat.' }, { status: 403 })

  const body = await req.json()
  const { nazev, config, htmlContent, cssContent } = body

  await prisma.quoteTemplate.update({
    where: { id: params.id },
    data: {
      ...(nazev !== undefined ? { nazev } : {}),
    },
  })

  if (config !== undefined) {
    const allowed: Record<string, unknown> = {}
    const configFields = [
      'primaryColor', 'accentColor', 'headerText',
      'footerLine1', 'footerLine2', 'footerLine3',
      'showOpKod', 'showDatumPlatnosti', 'showPoznamka', 'logoUrl',
    ]
    for (const field of configFields) {
      if (config[field] !== undefined) allowed[field] = config[field]
    }
    await prisma.quoteTemplateConfig.upsert({
      where: { templateId: params.id },
      create: { templateId: params.id, ...allowed },
      update: allowed,
    })
  }

  if (htmlContent !== undefined || cssContent !== undefined) {
    if (template.typ !== 'CUSTOM_HTML') {
      return NextResponse.json({ error: 'HTML lze editovat jen u CUSTOM_HTML šablon' }, { status: 400 })
    }
    await prisma.quoteTemplateHtml.upsert({
      where: { templateId: params.id },
      create: {
        templateId: params.id,
        htmlContent: htmlContent ?? '',
        cssContent: cssContent ?? null,
      },
      update: {
        ...(htmlContent !== undefined ? { htmlContent } : {}),
        ...(cssContent !== undefined ? { cssContent } : {}),
      },
    })
  }

  const updated = await prisma.quoteTemplate.findUnique({
    where: { id: params.id },
    include: { config: true, htmlTemplate: true },
  })

  return NextResponse.json(updated)
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const orgId = session.user.orgId
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const template = await prisma.quoteTemplate.findFirst({
    where: { id: params.id, orgId },
  })
  if (!template) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.$transaction([
    prisma.quote.updateMany({ where: { templateId: params.id }, data: { templateId: null } }),
    prisma.orgTemplateMapping.deleteMany({ where: { templateId: params.id } }),
    prisma.quoteTemplate.delete({ where: { id: params.id } }),
  ])

  return NextResponse.json({ ok: true })
}
