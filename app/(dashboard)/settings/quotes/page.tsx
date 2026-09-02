import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import QuoteTemplatesSettings from './QuoteTemplatesSettings'
import { getOrgSettings } from '@/lib/orgSettings'
import { getPerms } from '@/lib/permissions'

export default async function QuoteTemplatesPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/login')
  const orgId = session.user.orgId
  const isAdmin = getPerms(session.user).nastaveniOrg

  if (!isAdmin) redirect('/settings')

  const [templates, org, orgSettings, mappings, sampleQuote] = await Promise.all([
    prisma.quoteTemplate.findMany({
      where: { orgId },
      include: { config: true, htmlTemplate: { select: { id: true, templateId: true, cssContent: true } } },
      orderBy: [{ isDefault: 'desc' }, { vytvoreno: 'asc' }],
    }),
    prisma.organization.findUnique({ where: { id: orgId }, select: { plan: true } }),
    getOrgSettings(orgId),
    prisma.orgTemplateMapping.findMany({
      where: { orgId },
      select: { id: true, technologie: true, templateId: true },
    }),
    prisma.quote.findFirst({
      where: { deal: { orgId } },
      select: { id: true },
      orderBy: { vytvoreno: 'desc' },
    }),
  ])

  return (
    <QuoteTemplatesSettings
      initialTemplates={JSON.parse(JSON.stringify(templates))}
      plan={org?.plan ?? 'STARTER'}
      sampleQuoteId={sampleQuote?.id ?? null}
      initialSingleTemplate={orgSettings.singleTemplate}
      initialMappings={JSON.parse(JSON.stringify(mappings))}
    />
  )
}
