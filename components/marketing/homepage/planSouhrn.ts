// Souhrn plánů pro ceník, JSON-LD i llms.txt - jediné místo, kde se z konfigurace
// (lib/landing.ts PLANS, lib/planLimits.ts, lib/dasaLimits.ts, lib/modulPodpisy.ts)
// skládají texty o plánech. Žádné číslo tu není natvrdo. Jen pro server.

import { PLANS, formatPrice, type PlanId } from '@/lib/landing'
import { getPlanLimits } from '@/lib/planLimits'
import { formatDasaLimit } from '@/lib/dasaLimits'
import { PODPISY_CENA_LICENCE, PODPISY_MESICNI_LIMIT } from '@/lib/modulPodpisy'

const BEZ_LIMITU = 'bez limitu'

function pocet(n: number, jednotka?: string): string {
  if (n === Infinity) return BEZ_LIMITU
  return jednotka ? `${new Intl.NumberFormat('cs-CZ').format(n)} ${jednotka}` : new Intl.NumberFormat('cs-CZ').format(n)
}

function uzivatele(n: number): string {
  if (n === Infinity) return BEZ_LIMITU
  return n === 1 ? '1 uživatel' : `do ${n} uživatelů`
}

function sablony(nabidky: number, smlouvy: number): string {
  if (nabidky === Infinity && smlouvy === Infinity) return BEZ_LIMITU
  const n = nabidky === 1 ? '1 nabídka' : `${pocet(nabidky)} nabídek`
  const s = smlouvy === 1 ? '1 smlouva' : `${pocet(smlouvy)} smluv`
  return `${n}, ${s}`
}

export function podpisDostupnost(plan: PlanId): string {
  const l = getPlanLimits(plan)
  if (l.hasOnlinePodpis) return 'v ceně'
  if (plan === 'STANDARD') return `příplatek ${formatPrice(PODPISY_CENA_LICENCE)} Kč za licenci měsíčně, do ${PODPISY_MESICNI_LIMIT} smluv`
  return 'ne'
}

/** Věta pro krok Smlouva a mřížku detailů. */
export function podpisDostupnostVeta(): string {
  const vCene = PLANS.filter(p => getPlanLimits(p.id).hasOnlinePodpis).map(p => p.name)
  return `V ceně plánů ${vCene.join(' a ')}, ve Standard za příplatek ${formatPrice(PODPISY_CENA_LICENCE)} Kč za licenci měsíčně (do ${PODPISY_MESICNI_LIMIT} smluv), ve Starter není.`
}

export function servisPlany(): string {
  return PLANS.filter(p => getPlanLimits(p.id).hasServiceModule).map(p => p.name).join(' a ')
}

export type Hodnota = string | boolean

export interface Radek {
  label: string
  hodnota: (plan: PlanId) => Hodnota
  /** zobrazit i v kartě plánu */
  karta?: boolean
}

export const RADKY: Radek[] = [
  { label: 'Uživatelé', hodnota: p => uzivatele(getPlanLimits(p).maxUsers), karta: true },
  { label: 'Servisní modul', hodnota: p => getPlanLimits(p).hasServiceModule, karta: true },
  { label: 'Elektronický podpis ověřený SMS kódem', hodnota: p => podpisDostupnost(p), karta: true },
  { label: 'AI asistentka Dáša', hodnota: p => formatDasaLimit(p), karta: true },
  { label: 'Šablony nabídek a smluv', hodnota: p => sablony(getPlanLimits(p).maxQuoteTemplates, getPlanLimits(p).maxContractTemplates), karta: true },
  { label: 'API klíče a webhooky', hodnota: () => true, karta: true },
  { label: 'Obchodní případy', hodnota: p => pocet(getPlanLimits(p).maxDeals) },
  { label: 'Produkty v katalogu', hodnota: p => pocet(getPlanLimits(p).maxProducts) },
  { label: 'Vlastní vzhled záhlaví a patičky dokumentů', hodnota: p => getPlanLimits(p).hasWhiteLabel },
  { label: 'Oprávnění upravená pro jednotlivé uživatele', hodnota: p => getPlanLimits(p).hasCustomPermissions },
  { label: 'Vlastní subdoména firma.felucia.io', hodnota: p => getPlanLimits(p).hasSubdomain },
  { label: 'Odezva podpory', hodnota: p => `do ${getPlanLimits(p).supportResponseHours} h` },
]

/** "Uživatelé: do 5 uživatelů; Servisní modul: ne; ..." - pro JSON-LD a llms.txt */
export function planSouhrn(plan: PlanId): string {
  return RADKY.map(r => {
    const v = r.hodnota(plan)
    return `${r.label}: ${v === true ? 'ano' : v === false ? 'ne' : v}`
  }).join('; ')
}
