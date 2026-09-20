import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { checkLogoUpload } from '@/lib/uploadSafety'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs/promises'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const { orgId } = session.user

  const formData = await req.formData()
  const primaryColor = (formData.get('primaryColor') as string) || '#4CAF50'
  const logoFile = formData.get('logo') as File | null

  let logoUrl: string | null = null

  if (logoFile && logoFile.size > 0) {
    const bytes = await logoFile.arrayBuffer()
    const buf = Buffer.from(bytes)
    if (buf.length > 2 * 1024 * 1024) return NextResponse.json({ error: 'Logo nesmí být větší než 2 MB' }, { status: 413 })
    const logo = checkLogoUpload(buf)
    if (!logo) return NextResponse.json({ error: 'Soubor není podporovaný obrázek' }, { status: 415 })
    const filename = `logo-${orgId}-${Date.now()}.${logo.ext}`
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'logos')
    await fs.mkdir(uploadDir, { recursive: true })
    await fs.writeFile(path.join(uploadDir, filename), buf)
    logoUrl = `/uploads/logos/${filename}`

    // Save to org logo
    await prisma.organization.update({ where: { id: orgId }, data: { logo: logoUrl } })
  }

  // Update org primary color setting
  await prisma.orgSettings.upsert({
    where: { orgId },
    update: { primaryColor },
    create: { orgId, primaryColor },
  })

  // Update default template config if exists
  const defaultTemplate = await prisma.quoteTemplate.findFirst({
    where: { orgId, isDefault: true },
    include: { config: true },
  })

  if (defaultTemplate) {
    if (defaultTemplate.config) {
      await prisma.quoteTemplateConfig.update({
        where: { templateId: defaultTemplate.id },
        data: {
          primaryColor,
          ...(logoUrl ? { logoUrl } : {}),
        },
      })
    } else {
      await prisma.quoteTemplateConfig.create({
        data: {
          templateId: defaultTemplate.id,
          primaryColor,
          ...(logoUrl ? { logoUrl } : {}),
        },
      })
    }
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: 4 },
  })

  return NextResponse.json({ ok: true, logoUrl })
}
