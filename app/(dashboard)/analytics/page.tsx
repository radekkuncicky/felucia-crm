import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { stavLabels } from '@/lib/constants'
import AnalyticsCharts from './AnalyticsCharts'

export default async function AnalyticsPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const deals = await prisma.deal.findMany({
    where: { orgId },
    include: {
      quotes: { where: { aktivni: true }, include: { items: true } },
      quoteItems: { where: { quoteId: null } },
      user: { select: { jmeno: true } },
      client: { select: { jmeno: true, prijmeni: true } },
    },
    orderBy: { vytvoreno: 'asc' },
  })

  // Compute konecnaCena for each deal
  const dealsWithPrice = deals.map(d => {
    const activeQuote = d.quotes[0]
    const items = activeQuote ? activeQuote.items : d.quoteItems
    const konecnaCena = items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
    return { ...d, konecnaCena }
  })

  // Funnel data
  const stavOrder = ['NOVY', 'JEDNANI', 'NABIDKA', 'PRED_UZAVRENIM', 'USPECH', 'PAS'] as const
  const funnelData = stavOrder.map(stav => ({
    stav,
    label: stavLabels[stav],
    count: dealsWithPrice.filter(d => d.stav === stav).length,
    value: dealsWithPrice.filter(d => d.stav === stav).reduce((s, d) => s + d.konecnaCena, 0),
  }))

  // Monthly data for last 12 months
  const now = new Date()
  const monthlyData: { month: string; count: number; value: number; uspech: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
    const monthDeals = dealsWithPrice.filter(deal => {
      const created = new Date(deal.vytvoreno)
      return created >= d && created < nextD
    })
    monthlyData.push({
      month: d.toLocaleDateString('cs-CZ', { month: 'short', year: '2-digit' }),
      count: monthDeals.length,
      value: monthDeals.reduce((s, d) => s + d.konecnaCena, 0),
      uspech: monthDeals.filter(d => d.stav === 'USPECH').length,
    })
  }

  // Per user
  const userMap = new Map<string, { jmeno: string; total: number; uspech: number; value: number }>()
  dealsWithPrice.forEach(d => {
    const jmeno = d.user?.jmeno ?? 'Neznámý'
    if (!userMap.has(jmeno)) userMap.set(jmeno, { jmeno, total: 0, uspech: 0, value: 0 })
    const u = userMap.get(jmeno)!
    u.total++
    if (d.stav === 'USPECH') u.uspech++
    u.value += d.konecnaCena
  })
  const userData = Array.from(userMap.values()).sort((a, b) => b.value - a.value)

  const dealsForTable = dealsWithPrice.map(d => ({
    id: d.id,
    kod: d.kod ?? '—',
    klient: `${d.client.jmeno} ${d.client.prijmeni}`.trim(),
    stav: d.stav,
    jmeno: d.user?.jmeno ?? 'Neznámý',
    konecnaCena: d.konecnaCena,
    vytvoreno: d.vytvoreno.toISOString(),
  }))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Analýzy</h1>
      <AnalyticsCharts funnelData={funnelData} monthlyData={monthlyData} userData={userData} deals={dealsForTable} />
    </div>
  )
}
