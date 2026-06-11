import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getOrgSettings } from '@/lib/orgSettings'
import { getPlanLimits } from '@/lib/planLimits'
import DokumentySettingsForm from './DokumentySettingsForm'

export const dynamic = 'force-dynamic'

export default async function DokumentySettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/settings')

  const settings = await getOrgSettings(session.user.orgId)
  const hasWhiteLabel = getPlanLimits(session.user.plan).hasWhiteLabel

  return (
    <DokumentySettingsForm
      initial={{
        dokumentyStyl: settings.dokumentyStyl,
        dokumentyPaticka: settings.dokumentyPaticka,
        dokumentyCislovani: settings.dokumentyCislovani,
        dokumentyHeaderHtml: settings.dokumentyHeaderHtml,
        dokumentyFooterHtml: settings.dokumentyFooterHtml,
      }}
      hasWhiteLabel={hasWhiteLabel}
    />
  )
}
