import { parseDasaOdpoved, type AgentVysledek } from './agent'

/** Tvar odpovědi /api/ai-assistant a /api/ai-assistant/confirm pro components/AIAssistant.tsx */
export function odpovedKlientovi(v: AgentVysledek, creditsUsed: number, creditsLimit: number) {
  const { message, quickReplies } = parseDasaOdpoved(v.text)
  return {
    message: message || (v.typ === 'potvrzeni' ? '' : 'Omlouvám se, nepodařilo se dokončit odpověď.'),
    quickReplies: v.typ === 'potvrzeni' ? [] : quickReplies,
    navigateTo: v.navigateTo,
    pendingAction: v.typ === 'potvrzeni' ? { id: v.cekajiciId, akce: v.akce } : undefined,
    creditsUsed,
    creditsLimit: creditsLimit === Infinity ? null : creditsLimit,
  }
}
