import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const STRIPE_PLANS: Record<string, string> = {
  STARTER:      process.env.STRIPE_STARTER_PRICE_ID!,
  STANDARD:     process.env.STRIPE_STANDARD_PRICE_ID!,
  PROFESSIONAL: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
}
