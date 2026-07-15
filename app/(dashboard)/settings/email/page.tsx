import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { orgPrisma } from '@/lib/orgPrisma'
import { isEmailConfigured } from '@/lib/email'
import EmailSettingsForm from './EmailSettingsForm'

export const dynamic = 'force-dynamic'

export default async function EmailSettingsPage() {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') redirect('/settings')

  const db = orgPrisma(session.user.orgId)
  const s = await db.orgEmailSettings.findUnique({ where: { orgId: session.user.orgId } })

  return (
    <EmailSettingsForm
      initial={
        s
          ? {
              rezim: s.rezim === 'VLASTNI_SMTP' ? ('VLASTNI_SMTP' as const) : ('FELUCIA' as const),
              smtpHost: s.smtpHost,
              smtpPort: s.smtpPort,
              smtpSecure: s.smtpSecure,
              smtpUser: s.smtpUser,
              fromName: s.fromName,
              fromEmail: s.fromEmail,
              overeno: s.overeno?.toISOString() ?? null,
            }
          : null
      }
      globalFallback={isEmailConfigured()}
      userEmail={session.user.email ?? ''}
    />
  )
}
