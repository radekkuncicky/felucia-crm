export const PLAN_LIMITS = {
  STARTER: {
    maxUsers: 1,
    maxDeals: 20,
    maxProducts: 100,
    maxQuoteTemplates: 1,
    maxContractTemplates: 1,
    canEditTemplateFooter: false,
    canUseAI: false,
    aiTokensPerMonth: 0,
    aiCreditsPerMonth: 0,
    hasSubdomain: true,
    hasCustomDomain: false,
    hasWhiteLabel: false,
    hasServiceModule: false,
    hasOnlinePodpis: false,
    hasCustomPermissions: false,
    supportResponseHours: 48,
  },
  STANDARD: {
    maxUsers: 5,
    maxDeals: Infinity,
    maxProducts: Infinity,
    maxQuoteTemplates: 10,
    maxContractTemplates: 10,
    canEditTemplateFooter: true,
    canUseAI: true,
    aiTokensPerMonth: 500,
    aiCreditsPerMonth: 200,
    hasSubdomain: true,
    hasCustomDomain: false,
    hasWhiteLabel: false,
    hasServiceModule: false,
    hasOnlinePodpis: false,
    hasCustomPermissions: true,
    supportResponseHours: 24,
  },
  PROFESSIONAL: {
    maxUsers: 20,
    maxDeals: Infinity,
    maxProducts: Infinity,
    maxQuoteTemplates: Infinity,
    maxContractTemplates: Infinity,
    canEditTemplateFooter: true,
    canUseAI: true,
    aiTokensPerMonth: Infinity,
    aiCreditsPerMonth: 1000,
    hasSubdomain: true,
    hasCustomDomain: true,
    hasWhiteLabel: true,
    hasServiceModule: true,
    hasOnlinePodpis: true,
    hasCustomPermissions: true,
    supportResponseHours: 4,
  },
  ENTERPRISE: {
    maxUsers: Infinity,
    maxDeals: Infinity,
    maxProducts: Infinity,
    maxQuoteTemplates: Infinity,
    maxContractTemplates: Infinity,
    canEditTemplateFooter: true,
    canUseAI: true,
    aiTokensPerMonth: Infinity,
    aiCreditsPerMonth: Infinity,
    hasSubdomain: true,
    hasCustomDomain: true,
    hasWhiteLabel: true,
    hasServiceModule: true,
    hasOnlinePodpis: true,
    hasCustomPermissions: true,
    supportResponseHours: 1,
  },
} as const

export type OrgPlan = keyof typeof PLAN_LIMITS

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[(plan as OrgPlan) in PLAN_LIMITS ? (plan as OrgPlan) : 'STARTER']
}


export function canPerformAction(plan: string, action: string): boolean {
  const limits = getPlanLimits(plan)
  switch (action) {
    case 'use_ai': return limits.canUseAI
    case 'edit_template_footer': return limits.canEditTemplateFooter
    case 'custom_domain': return limits.hasCustomDomain
    case 'white_label': return limits.hasWhiteLabel
    case 'service_module': return limits.hasServiceModule
    default: return false
  }
}
