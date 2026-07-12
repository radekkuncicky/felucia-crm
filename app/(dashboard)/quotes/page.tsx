import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import { formatDate, formatCislo } from '@/lib/format'

export default async function QuotesPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId

  const quotes = await prisma.quote.findMany({
    where: { orgId },
    include: {
      deal: {
        include: { client: true },
      },
      items: true,
    },
    orderBy: { vytvoreno: 'desc' },
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cenové nabídky</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400">{quotes.length} nabídek celkem</p>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Název nabídky</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Obchodní případ</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Klient</th>
              <th className="text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Celková cena</th>
              <th className="text-center text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Aktivní</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Datum</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {quotes.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    title="Zatím žádné cenové nabídky"
                    description="Nabídka se vytváří v detailu obchodního případu na záložce Nabídky — ručně, z produktů, nebo jedním klikem ze vzorové nabídky."
                    actionLabel="Přejít na obchodní případy"
                    actionHref="/deals"
                  />
                </td>
              </tr>
            )}
            {quotes.map((q) => {
              const celkem = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
              return (
                <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 dark:text-white">{q.nazev}</p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{q.items.length} položek</p>
                  </td>
                  <td className="px-6 py-4">
                    <Link href={`/deals/${q.dealId}?tab=nabidky`} className="text-sm text-blue-600 hover:underline font-medium">
                      {q.deal.kod ? (
                        <span className="font-mono bg-gray-100 dark:bg-slate-700 px-1.5 py-0.5 rounded text-xs mr-2">{q.deal.kod}</span>
                      ) : null}
                      {q.deal.predmet ?? 'Bez předmětu'}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">
                    {q.deal.client.jmeno} {q.deal.client.prijmeni}
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {celkem > 0 ? formatCislo(celkem) + ' Kč' : '—'}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {q.aktivni ? (
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-1 rounded-full">Aktivní</span>
                    ) : (
                      <span className="bg-gray-100 dark:bg-slate-700 text-gray-500 dark:text-slate-400 text-xs font-medium px-2 py-1 rounded-full">—</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                    {formatDate(q.vytvoreno)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link
                      href={`/deals/${q.dealId}?tab=nabidky`}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Detail →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
