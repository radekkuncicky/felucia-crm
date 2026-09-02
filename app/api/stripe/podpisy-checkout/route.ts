import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { stripe, STRIPE_PODPISY_PRICE_ID } from '@/lib/stripe'
import { getPerms } from '@/lib/permissions'

// Checkout příplatkového modulu Online podpis smluv (jen plán STANDARD).
// Množství = počet aktivních licencí (uživatelů) organizace.
export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session || !getPerms(session.user).fakturace) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!STRIPE_PODPISY_PRICE_ID) {
    return NextResponse.json({ error: 'Modul zatím není v prodeji — kontaktujte podporu' }, { status: 503 })
  }
  if (session.user.plan !== 'STANDARD') {
    return NextResponse.json({ error: 'Modul je určen pro plán STANDARD — vyšší plány ho mají v ceně' }, { status: 422 })
  }

  const orgId = session.user.orgId
  let org = await prisma.organization.findUnique({ where: { id: orgId } })
  if (!org) return NextResponse.json({ error: 'Organization not found' }, { status: 404 })
  if (org.modulPodpisy) {
    return NextResponse.json({ error: 'Modul už je aktivní' }, { status: 422 })
  }

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

  const licence = await prisma.user.count({ where: { orgId, aktivni: true } })

  const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? 'felucia.io'
  const baseUrl = `https://${org.slug}.${rootDomain}`

  const checkout = await stripe.checkout.sessions.create({
    customer: org.stripeCustomerId!,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: STRIPE_PODPISY_PRICE_ID, quantity: Math.max(1, licence) }],
    success_url: `${baseUrl}/settings/billing?success=true`,
    cancel_url: `${baseUrl}/settings/billing?canceled=true`,
    metadata: { orgId: org.id, addon: 'PODPISY' },
    locale: 'cs',
  })

  return NextResponse.json({ url: checkout.url })
}
