import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import DashboardShell from '@/components/DashboardShell'
import AIAssistant from '@/components/AIAssistant'
import { Suspense } from 'react'
import OnboardingModal from '@/components/OnboardingModal'
import { getOrgSettings } from '@/lib/orgSettings'
import { cookies } from 'next/headers'
import ImpersonationBanner from '@/components/ImpersonationBanner'
import DemoBanner from '@/components/DemoBanner'
import { prisma } from '@/lib/prisma'
import CommandPalette from '@/components/CommandPalette'
import TrialBanner from '@/components/TrialBanner'
import OnboardingBanner from '@/components/OnboardingBanner'
import { PaywallModal } from '@/components/PaywallModal'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getServerSession(authOptions)

  if (!session) redirect('/login')

  const orgSettings = await getOrgSettings(session.user.orgId)

  // Trial + onboarding status
  const org = await prisma.organization.findUnique({
    where: { id: session.user.orgId },
    select: { nazev: true, trialEndsAt: true, trialStartedAt: true, onboardingDone: true, onboardingStep: true },
  })
  const now = new Date()
  const trialDaysLeft = org?.trialEndsAt
    ? Math.max(0, Math.ceil((org.trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
    : null
  const trialExpired = org?.trialEndsAt ? org.trialEndsAt < now && session.user.plan === 'STARTER' : false

  // Impersonation banner
  const cookieStore = cookies()
  const impersonateCookie = cookieStore.get('sa_impersonate')
  let impersonateData: { superAdminJmeno: string; orgNazev: string } | null = null
  if (impersonateCookie) {
    try {
      impersonateData = JSON.parse(impersonateCookie.value)
    } catch {}
  }

  // Announcement banner
  const sysSettings = await prisma.systemSettings.findFirst()
  const announcement = sysSettings?.announcementActive && sysSettings.announcementText
    ? { text: sysSettings.announcementText, color: sysSettings.announcementColor }
    : null

  const isDemo = session.user.isDemo ?? false
  const bannerCount = (impersonateData ? 1 : 0) + (announcement ? 1 : 0)

  // Count fixed banners for padding
  const trialBannerActive = !isDemo && ((trialDaysLeft !== null && trialDaysLeft > 0 && org?.trialStartedAt) || trialExpired)
  const totalFixedBanners = bannerCount + (trialBannerActive ? 1 : 0) + (isDemo ? 1 : 0)

  return (
    <>
      {isDemo && <DemoBanner />}
      {!isDemo && trialBannerActive && (
        <TrialBanner trialDaysLeft={trialDaysLeft} trialExpired={trialExpired} />
      )}
      {impersonateData && (
        <ImpersonationBanner
          orgNazev={impersonateData.orgNazev}
          superAdminJmeno={impersonateData.superAdminJmeno}
        />
      )}
      {announcement && (
        <div
          className="fixed left-0 right-0 z-40 text-center py-2 px-4 text-sm font-medium"
          style={{ backgroundColor: announcement.color, color: '#000', top: impersonateData ? '40px' : '0' }}
        >
          {announcement.text}
        </div>
      )}
      <div style={totalFixedBanners > 0 ? { paddingTop: `${totalFixedBanners * 40}px` } : undefined}>
        {!isDemo && !org?.onboardingDone && (
          <OnboardingBanner
            onboardingDone={org?.onboardingDone ?? true}
            onboardingStep={org?.onboardingStep ?? 0}
          />
        )}
        <DashboardShell
          user={{ jmeno: session.user.jmeno, email: session.user.email, role: session.user.role, perms: getPerms(session.user), plan: session.user.plan, isSuperAdmin: session.user.isSuperAdmin }}
          orgSettings={orgSettings}
          orgNazev={org?.nazev}
        >
          {children}
        </DashboardShell>
      </div>
      <AIAssistant />
      <CommandPalette />
      <Suspense fallback={null}>
        <OnboardingModal />
      </Suspense>
      <Suspense fallback={null}>
        <PaywallModal />
      </Suspense>
    </>
  )
}
