// Ceník #ceny. Žádné číslo tu není natvrdo: ceny z lib/landing.ts (PLANS),
// limity z lib/planLimits.ts, Dáša z lib/dasaLimits.ts, příplatek za online
// podpis z lib/modulPodpisy.ts. Serverová komponenta (srovnání přes details).

import { cn } from '@/lib/cn'
import { CONTACT, PLANS, formatPrice, type PlanId } from '@/lib/landing'
import { getPlanLimits } from '@/lib/planLimits'
import { formatDasaLimit } from '@/lib/dasaLimits'
import { PODPISY_CENA_LICENCE, PODPISY_MESICNI_LIMIT } from '@/lib/modulPodpisy'
import { IconCheck } from '../icons'
import { CENY } from './content'

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

type Hodnota = string | boolean

interface Radek {
  label: string
  hodnota: (plan: PlanId) => Hodnota
  /** zobrazit i v kartě plánu */
  karta?: boolean
}

const RADKY: Radek[] = [
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

function Bunka({ v }: { v: Hodnota }) {
  if (v === true) return <span className="inline-flex items-center gap-1 font-semibold text-[var(--mk-green-ink)]"><IconCheck className="h-4 w-4" />ano</span>
  if (v === false || v === 'ne' || v === 'není v plánu') return <span className="text-[var(--mk-faint)]">{v === false ? 'ne' : v}</span>
  return <span>{v}</span>
}

export function Cenik() {
  return (
    <div>
      <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {PLANS.map(plan => (
          <li key={plan.id} className="flex flex-col rounded-[var(--mk-radius)] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)] p-5">
            <h3 className="mk-display text-[20px] font-semibold">{plan.name}</h3>
            <p className="mt-3">
              {plan.price !== null ? (
                <>
                  <span className="mk-display text-[34px] font-semibold leading-none">{formatPrice(plan.price)} Kč</span>
                  <span className="mt-1 block text-[13px] text-[var(--mk-muted)]">{CENY.jednotka}</span>
                </>
              ) : (
                <>
                  <span className="mk-display text-[26px] font-semibold leading-none">Individuálně</span>
                  <span className="mt-1 block text-[13px] text-[var(--mk-muted)]">pro větší týmy, {CENY.jednotka}</span>
                </>
              )}
            </p>
            <dl className="mt-5 flex-1 space-y-2.5 border-t border-[var(--mk-line)] pt-4 text-[14px]">
              {RADKY.filter(r => r.karta).map(r => (
                <div key={r.label} className="flex flex-col">
                  <dt className="text-[12px] text-[var(--mk-muted)]">{r.label}</dt>
                  <dd className="font-medium"><Bunka v={r.hodnota(plan.id)} /></dd>
                </div>
              ))}
            </dl>
            <a
              href={plan.price === null ? `mailto:${CONTACT.email}` : '#ukazka'}
              className={cn(
                'mt-6 inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-[14.5px] font-semibold',
                'border border-[var(--mk-ink)] text-[var(--mk-ink)] hover:bg-[var(--mk-ink)] hover:text-white',
              )}
            >
              {plan.price === null ? 'Napsat nám' : 'Domluvit ukázku'}
            </a>
          </li>
        ))}
      </ul>

      <details className="group mt-6 rounded-[var(--mk-radius)] border border-[var(--mk-line-strong)] bg-[var(--mk-surface)]">
        <summary className="flex cursor-pointer items-center justify-between gap-3 rounded-[var(--mk-radius)] px-5 py-4 text-[15px] font-semibold">
          Srovnání všech funkcí
          <span aria-hidden="true" className="text-[20px] leading-none text-[var(--mk-green-ink)] transition-transform group-open:rotate-45">+</span>
        </summary>
        <div className="mk-scroll-x border-t border-[var(--mk-line)]" role="region" aria-label="Srovnávací tabulka plánů" tabIndex={0}>
          <table className="mk-table w-full min-w-[720px] border-collapse text-left text-[14px]">
            <caption className="sr-only">Srovnání plánů Felucia, ceny {CENY.jednotka}</caption>
            <thead>
              <tr className="border-b border-[var(--mk-line)]">
                <th scope="col" className="px-5 py-3 font-medium text-[var(--mk-muted)]">Funkce</th>
                {PLANS.map(p => (
                  <th key={p.id} scope="col" className="px-4 py-3">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block text-[12.5px] font-normal text-[var(--mk-muted)]">{p.price !== null ? `${formatPrice(p.price)} Kč` : 'individuálně'}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RADKY.map(r => (
                <tr key={r.label} className="border-b border-[var(--mk-line)] last:border-0">
                  <th scope="row" className="px-5 py-3 font-medium">{r.label}</th>
                  {PLANS.map(p => (
                    <td key={p.id} className="px-4 py-3 align-top"><Bunka v={r.hodnota(p.id)} /></td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
      <p className="mt-3 text-[13px] text-[var(--mk-muted)]">Všechny ceny jsou {CENY.jednotka}.</p>
    </div>
  )
}
