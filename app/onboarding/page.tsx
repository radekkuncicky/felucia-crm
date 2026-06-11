import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import OnboardingWizard from './OnboardingWizard'

export default async function OnboardingPage() {
  const session = await getServerSession(authOptions)
  if (!session) redirect('/auth/signin')

  const { orgId } = session.user

  const [org, user, categories] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: { nazev: true, ico: true, dic: true, sidlo: true, onboardingDone: true, onboardingStep: true },
    }),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { jmeno: true, email: true, telefon: true },
    }),
    prisma.category.findMany({ where: { orgId }, select: { nazev: true } }),
  ])

  // When onboardingDone=true, restart wizard from step 1 (review mode)
  const initialStep = org?.onboardingDone ? 0 : (org?.onboardingStep ?? 0)

  return (
    <OnboardingWizard
      initialStep={initialStep}
      orgNazev={org?.nazev ?? ''}
      orgIco={org?.ico ?? ''}
      orgDic={org?.dic ?? ''}
      orgSidlo={org?.sidlo ?? ''}
      userName={user?.jmeno ?? session.user.jmeno}
      userEmail={user?.email ?? session.user.email ?? ''}
      userTelefon={user?.telefon ?? ''}
      existingCategories={categories.map(c => c.nazev)}
    />
  )
}
