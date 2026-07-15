import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

export const STRIPE_PLANS: Record<string, string> = {
  STARTER:      process.env.STRIPE_STARTER_PRICE_ID!,
  STANDARD:     process.env.STRIPE_STANDARD_PRICE_ID!,
  PROFESSIONAL: process.env.STRIPE_PROFESSIONAL_PRICE_ID!,
}

// Příplatkový modul Online podpis smluv (99 Kč/licence/měsíc, jen STANDARD).
// Price vytvořit ve Stripe dashboardu (recurring, per unit, CZK) a ID doplnit
// do .env — bez něj je aktivace modulu v UI nedostupná.
export const STRIPE_PODPISY_PRICE_ID = process.env.STRIPE_PODPISY_PRICE_ID
