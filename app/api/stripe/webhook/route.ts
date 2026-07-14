import { NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { prisma } from '@/lib/prisma'
import Stripe from 'stripe'

export const runtime = 'nodejs'

// Disable body parsing so we can verify the raw signature
export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
  const sig = req.headers.get('stripe-signature')
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!sig || !webhookSecret) {
    return NextResponse.json({ error: 'Missing signature or secret' }, { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const orgId = session.metadata?.orgId
        const plan = session.metadata?.plan

        // Příplatkový modul Online podpis (druhá subscription vedle plánu)
        if (orgId && session.metadata?.addon === 'PODPISY') {
          await prisma.organization.update({
            where: { id: orgId },
            data: {
              modulPodpisy: true,
              stripePodpisySubId: session.subscription as string,
            },
          })
          console.log(`[Stripe] Org ${orgId} aktivoval modul PODPISY`)
          break
        }

        if (!orgId || !plan) break

        // Fetch subscription to get the actual period end
        let planActiveTo = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        if (session.subscription) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string)
          const periodEnd = sub.items?.data?.[0]?.current_period_end
          if (periodEnd) planActiveTo = new Date(periodEnd * 1000)
        }

        await prisma.organization.update({
          where: { id: orgId },
          data: {
            plan: plan as 'STARTER' | 'STANDARD' | 'PROFESSIONAL' | 'ENTERPRISE',
            stripePlanId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionStatus: 'active',
            stripeCurrentPeriodEnd: planActiveTo,
            planActiveTo,
          },
        })
        console.log(`[Stripe] Org ${orgId} upgraded to ${plan}, active to ${planActiveTo.toISOString()}`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const org = await prisma.organization.findFirst({
          where: { stripeCustomerId: sub.customer as string },
        })
        if (!org) break

        // Zákazník může mít dvě subscriptions (plán + modul PODPISY) — update
        // modulu nesmí přepsat platnost plánu
        if (org.stripePodpisySubId && sub.id === org.stripePodpisySubId) {
          const aktivni = sub.status === 'active' || sub.status === 'trialing'
          await prisma.organization.update({
            where: { id: org.id },
            data: { modulPodpisy: aktivni },
          })
          console.log(`[Stripe] Org ${org.id} modul PODPISY ${aktivni ? 'aktivní' : 'pozastaven'} (${sub.status})`)
          break
        }

        // current_period_end is on the first subscription item in Stripe v21+
        const periodEnd = sub.items?.data?.[0]?.current_period_end
        const activeTo = periodEnd ? new Date(periodEnd * 1000) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            stripeSubscriptionStatus: sub.status,
            stripeCurrentPeriodEnd: activeTo,
            planActiveTo: activeTo,
          },
        })
        console.log(`[Stripe] Org ${org.id} subscription updated (${sub.status}), active to ${activeTo.toISOString()}`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const org = await prisma.organization.findFirst({
          where: { stripeCustomerId: sub.customer as string },
        })
        if (!org) break

        // Zrušení modulu PODPISY nesmí shodit celý plán na STARTER
        if (org.stripePodpisySubId && sub.id === org.stripePodpisySubId) {
          await prisma.organization.update({
            where: { id: org.id },
            data: { modulPodpisy: false, stripePodpisySubId: null },
          })
          console.log(`[Stripe] Org ${org.id} zrušil modul PODPISY`)
          break
        }

        await prisma.organization.update({
          where: { id: org.id },
          data: {
            plan: 'STARTER',
            stripePlanId: null,
            stripeSubscriptionStatus: 'canceled',
            stripeCurrentPeriodEnd: null,
            planActiveTo: null,
          },
        })
        console.log(`[Stripe] Org ${org.id} subscription cancelled, downgraded to STARTER`)
        break
      }

      default:
        console.log(`[Stripe] Unhandled event: ${event.type}`)
    }
  } catch (err) {
    console.error('[Stripe] Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
