import { getServerSession } from 'next-auth'
import { forbidden, getPerms } from '@/lib/permissions'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!getPerms(session.user).nastaveniOrg) return forbidden()
  const { orgId } = session.user

  const body = await req.json()
  const categories: string[] = body.categories ?? []

  const COLORS = ['#4CAF50', '#2196F3', '#FF9800', '#9C27B0', '#F44336', '#00BCD4', '#FF5722', '#607D8B', '#8BC34A', '#E91E63']

  // Existing categories (keep 'Obecné' if present)
  const existing = await prisma.category.findMany({ where: { orgId }, select: { nazev: true } })
  const existingNames = new Set(existing.map(c => c.nazev))

  let poradi = existing.length
  for (const nazev of categories) {
    if (!nazev.trim() || existingNames.has(nazev.trim())) continue
    await prisma.category.create({
      data: {
        orgId,
        nazev: nazev.trim(),
        barva: COLORS[poradi % COLORS.length],
        poradi: poradi++,
      },
    })
    existingNames.add(nazev.trim())
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: { onboardingStep: 3 },
  })

  return NextResponse.json({ ok: true, count: poradi })
}
