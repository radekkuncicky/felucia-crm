import { describe, it, expect, beforeAll, vi } from 'vitest'

// Stripe env PŘED importem lib/stripe — test nikdy nesahá na živé klíče z .env
vi.hoisted(() => {
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy'
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_billing'
  process.env.STRIPE_STARTER_PRICE_ID = 'price_test_starter'
  process.env.STRIPE_STANDARD_PRICE_ID = 'price_test_standard'
  process.env.STRIPE_PROFESSIONAL_PRICE_ID = 'price_test_pro'
})

vi.mock('next-auth', () => ({ getServerSession: vi.fn() }))

import { prisma } from '@/lib/prisma'
import { stripe } from '@/lib/stripe'
import { POST as webhook } from '@/app/api/stripe/webhook/route'
import { POST as createCheckout } from '@/app/api/stripe/create-checkout/route'
import { getServerSession } from 'next-auth'

/**
 * Předplatné: webhook drží plán firmy v souladu se Stripe (i při změně plánu
 * v zákaznickém portálu) a checkout nezaloží druhé předplatné.
 */

const RUN = `stripe-${Date.now()}`
const PERIOD_END = Math.floor(Date.now() / 1000) + 30 * 86400

let orgId: string
let adminId: string
const customer = `cus_${RUN}`

function signed(event: Record<string, unknown>) {
  const payload = JSON.stringify({ id: `evt_${Math.random()}`, object: 'event', ...event })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! })
  return new Request('http://localhost/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  })
}

function sub(id: string, price: string, status = 'active') {
  return {
    id, object: 'subscription', customer, status,
    items: { data: [{ current_period_end: PERIOD_END, price: { id: price } }] },
  }
}

async function org() {
  return prisma.organization.findUniqueOrThrow({ where: { id: orgId } })
}

beforeAll(async () => {
  const o = await prisma.organization.create({ data: { nazev: 'Test Stripe', slug: RUN, plan: 'STARTER' } })
  orgId = o.id
  adminId = (await prisma.user.create({
    data: { orgId, jmeno: 'Bára Billing', email: `admin-${RUN}@example.cz`, role: 'ADMIN', hesloHash: 'x' },
  })).id
  vi.spyOn(stripe.subscriptions, 'retrieve').mockResolvedValue(sub('sub_A', 'price_test_standard') as never)
})

describe('webhook', () => {
  it('odmítne nepodepsanou událost', async () => {
    const res = await webhook(new Request('http://localhost', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=x' }, body: '{}' }))
    expect(res.status).toBe(400)
  })

  it('checkout.session.completed nastaví plán a hlavní předplatné', async () => {
    const res = await webhook(signed({
      type: 'checkout.session.completed',
      data: { object: { object: 'checkout.session', metadata: { orgId, plan: 'STANDARD' }, subscription: 'sub_A', customer } },
    }))
    expect(res.status).toBe(200)
    const o = await org()
    expect(o.plan).toBe('STANDARD')
    expect(o.stripePlanId).toBe('sub_A')
    expect(o.stripeSubscriptionStatus).toBe('active')
    expect(o.planActiveTo?.getTime()).toBe(PERIOD_END * 1000)
  })

  it('změna plánu v portálu (jiná price) se promítne do plánu firmy', async () => {
    await webhook(signed({ type: 'customer.subscription.updated', data: { object: sub('sub_A', 'price_test_pro') } }))
    expect((await org()).plan).toBe('PROFESSIONAL')
    await webhook(signed({ type: 'customer.subscription.updated', data: { object: sub('sub_A', 'price_test_standard') } }))
    expect((await org()).plan).toBe('STANDARD')
  })

  it('neznámá price plán nemění, jen stav', async () => {
    await webhook(signed({ type: 'customer.subscription.updated', data: { object: sub('sub_A', 'price_neznama', 'past_due') } }))
    const o = await org()
    expect(o.plan).toBe('STANDARD')
    expect(o.stripeSubscriptionStatus).toBe('past_due')
    await webhook(signed({ type: 'customer.subscription.updated', data: { object: sub('sub_A', 'price_test_standard') } }))
  })

  it('události cizího předplatného hlavní plán nepřepíšou ani nezruší', async () => {
    await webhook(signed({ type: 'customer.subscription.updated', data: { object: sub('sub_B', 'price_test_starter', 'canceled') } }))
    await webhook(signed({ type: 'customer.subscription.deleted', data: { object: sub('sub_B', 'price_test_starter', 'canceled') } }))
    const o = await org()
    expect(o.plan).toBe('STANDARD')
    expect(o.stripePlanId).toBe('sub_A')
    expect(o.stripeSubscriptionStatus).toBe('active')
  })
})

describe('create-checkout', () => {
  it('při běžícím předplatném vrátí 409 a nezaloží druhé', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
    const create = vi.spyOn(stripe.checkout.sessions, 'create')
    const res = await createCheckout(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ plan: 'PROFESSIONAL' }) }))
    expect(res.status).toBe(409)
    expect((await res.json()).usePortal).toBe(true)
    expect(create).not.toHaveBeenCalled()
  })
})

describe('zrušení', () => {
  it('zrušení hlavního předplatného vrátí firmu na STARTER', async () => {
    await webhook(signed({ type: 'customer.subscription.deleted', data: { object: sub('sub_A', 'price_test_standard', 'canceled') } }))
    const o = await org()
    expect(o.plan).toBe('STARTER')
    expect(o.stripePlanId).toBeNull()
    expect(o.stripeSubscriptionStatus).toBe('canceled')
  })

  it('po zrušení jde znovu do checkoutu', async () => {
    vi.mocked(getServerSession).mockResolvedValue({ user: { id: adminId, orgId, role: 'ADMIN' } } as never)
    vi.spyOn(stripe.checkout.sessions, 'create').mockResolvedValue({ url: 'https://checkout.stripe.test/x' } as never)
    const res = await createCheckout(new Request('http://localhost', { method: 'POST', body: JSON.stringify({ plan: 'STANDARD' }) }))
    expect(res.status).toBe(200)
    expect((await res.json()).url).toContain('checkout.stripe.test')
  })
})
