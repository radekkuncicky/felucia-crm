import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { stripe, STRIPE_PLANS } from '@/lib/stripe'

export async function POST(req: Request) {
  const session = await getServerSession(authOptions)
  if (!session || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { plan } = await req.json() as { plan: 'STARTER' | 'STANDARD' | 'PROFESSIONAL' }

  if (!STRIPE_PLANS[plan]) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
  }

  const orgId = session.user.orgId
  let org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })

  // Create Stripe customer if not exists
  if (!org.stripeCustomerId) {
    const customer = await stripe.customers.create({
      email: session.user.email ?? undefined,
      name: org.nazev,
      metadata: { orgId: org.id, slug: org.slug },
    })
    org = await prisma.organization.update({
      where: { id: orgId },
      data: { stripeCustomerId: customer.id },
    })
  }

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'felucia.io'
  const baseUrl = `https://${org.slug}.${rootDomain}`

  const checkout = await stripe.checkout.sessions.create({
    customer: org.stripeCustomerId!,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PLANS[plan], quantity: 1 }],
    success_url: `${baseUrl}/settings/billing?success=true`,
    cancel_url: `${baseUrl}/settings/billing?canceled=true`,
    metadata: { orgId: org.id, plan },
    locale: 'cs',
  })

  return NextResponse.json({ url: checkout.url })
}
