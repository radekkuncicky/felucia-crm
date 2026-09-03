export const dynamic = 'force-dynamic'

import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms, dealScopeWhere } from '@/lib/permissions'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import DealsPageClient from './DealsPageClient'
import { getPlanLimits } from '@/lib/planLimits'
import UpgradeBanner from '@/components/UpgradeBanner'

export default async function DealsPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const perms = getPerms(session!.user)
  const scope = dealScopeWhere(perms, session!.user.id)
  if (!scope) redirect('/')
  // Zneplatněné OP vidí jen ten, kdo je smí zneplatňovat/mazat
  const showZneplatnene = perms.obchodMazani

  const org = await prisma.organization.findUnique({ where: { id: orgId } })
  const planLimits = getPlanLimits(org?.plan ?? 'STARTER')
  const dealCount = await prisma.deal.count({ where: { orgId } })
  const atLimit = planLimits.maxDeals !== Infinity && dealCount >= planLimits.maxDeals

  const deals = await prisma.deal.findMany({
    where: { orgId, ...scope, ...(showZneplatnene ? {} : { stav: { not: 'ZNEPLATNENO' as const } }) },
    include: {
      client: true,
      user: { select: { id: true, jmeno: true } },
      quotes: {
        where: { aktivni: true },
        include: { items: { include: { product: { select: { nakladovaCena: true } } } } },
      },
      quoteItems: { where: { quoteId: null } }, // legacy items without quote
    },
    orderBy: { vytvoreno: 'desc' },
  })

  const rows = deals.map((deal) => {
    // Active quote items take priority; fallback to legacy quoteItems
    const activeQuote = deal.quotes[0]
    const items = activeQuote ? activeQuote.items : deal.quoteItems
    const konecnaCena = items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus) * (1 - Number((i as { sleva?: unknown }).sleva ?? 0) / 100), 0)
    const dphSazbaForCalc = activeQuote?.dphSazba ?? deal.dphSazba
    const konecnaCenaSDph = konecnaCena * (1 + dphSazbaForCalc / 100)
    // Margin calculation — fallback: item.nakupniCena ?? product.nakladovaCena ?? cenaZaKus (0% margin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nakupniTotal = items.reduce((s, i: any) => {
      const nakladovaCena = i.nakupniCena != null ? Number(i.nakupniCena) : (i.product?.nakladovaCena != null ? Number(i.product.nakladovaCena) : Number(i.cenaZaKus))
      return s + Number(i.mnozstvi) * nakladovaCena * (1 - Number(i.sleva ?? 0) / 100)
    }, 0)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hasNakupni = items.some((i: any) => i.nakupniCena != null || Number(i.product?.nakladovaCena ?? 0) > 0)
    const marzeProc = perms.financeNakupky && hasNakupni && konecnaCena > 0 ? Math.round((konecnaCena - nakupniTotal) / konecnaCena * 1000) / 10 : null

    return {
      id: deal.id,
      kod: deal.kod,
      predmet: deal.predmet,
      stav: deal.stav,
      technologie: deal.technologie,
      dphSazba: deal.dphSazba,
      clientJmeno: `${deal.client.jmeno} ${deal.client.prijmeni}`,
      userJmeno: deal.user?.jmeno ?? null,
      konecnaCena,
      konecnaCenaSDph,
      marzeProc,
      vytvoreno: deal.vytvoreno.toISOString(),
      terminRealizace: deal.terminRealizace ? deal.terminRealizace.toISOString() : null,
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Obchodní případy</h1>
        <div className="flex items-center gap-2 ml-auto">
        <Link
          href="/cenovka"
          className="border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
        >
          ⚡ Rychlá cenovka
        </Link>
        {atLimit ? (
          <button
            disabled
            title="Dosáhli jste limitu obchodních případů. Upgradujte plán."
            className="bg-gray-300 dark:bg-slate-600 text-gray-500 dark:text-slate-400 font-medium px-4 py-2 rounded-lg text-sm cursor-not-allowed"
          >
            + Nový případ
          </button>
        ) : (
          <Link
            href="/deals/new"
            className="bg-primary hover:bg-primary-hover text-white font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + Nový případ
          </Link>
        )}
        </div>
      </div>

      <UpgradeBanner used={dealCount} limit={planLimits.maxDeals} label="obchodních případů" />

      <DealsPageClient deals={rows} showZneplatnene={showZneplatnene} showMarze={perms.financeNakupky} />
    </div>
  )
}
