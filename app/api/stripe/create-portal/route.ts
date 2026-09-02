import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { getPerms } from '@/lib/permissions'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).fakturace) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const orgId = session.user.orgId
  const org = await prisma.organization.findUnique({ where: { id: orgId } })

  if (!org?.stripeCustomerId) {
    return NextResponse.json({ error: 'No Stripe customer found' }, { status: 400 })
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'felucia.io'
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `https://${org.slug}.${rootDomain}/settings/billing`,
  })

  return NextResponse.json({ url: portalSession.url })
}
