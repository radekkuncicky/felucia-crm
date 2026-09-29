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

export type StripePlan = 'STARTER' | 'STANDARD' | 'PROFESSIONAL'

/** Plán podle price ID předplatného (změna plánu v zákaznickém portálu mění jen price). */
export function planFromPriceId(priceId: string | null | undefined): StripePlan | null {
  if (!priceId) return null
  const hit = Object.entries(STRIPE_PLANS).find(([, id]) => id && id === priceId)
  return (hit?.[0] as StripePlan | undefined) ?? null
}

/** Stavy, kdy firma má běžící předplatné plánu — nový checkout by založil druhé. */
export const ZIVE_STAVY_PREDPLATNEHO = ['active', 'trialing', 'past_due', 'incomplete', 'unpaid']
