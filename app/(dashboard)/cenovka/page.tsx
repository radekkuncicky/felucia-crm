import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CenovkaWizard from './CenovkaWizard'
import type { TemplateItem } from './CenovkaWizard'

export const metadata = { title: 'Rychlá cenovka' }

export default async function CenovkaPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')
  if (!getPerms(session.user).obchod) redirect('/dashboard')

  const templates = await prisma.quoteTemplate.findMany({
    where: { orgId: session.user.orgId },
    select: { id: true, nazev: true, popis: true, technologie: true, polozky: true },
    orderBy: { nazev: 'asc' },
  })

  return (
    <CenovkaWizard
      templates={templates
        .filter(t => Array.isArray(t.polozky) && (t.polozky as unknown[]).length > 0)
        .map(t => ({
          id: t.id,
          nazev: t.nazev,
          popis: t.popis,
          technologie: t.technologie,
          polozky: t.polozky as unknown as TemplateItem[],
        }))}
    />
  )
}
