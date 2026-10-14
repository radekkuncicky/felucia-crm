import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import type { Prisma, QuoteStav } from '@prisma/client'
import { getPerms, dealScopeWhere } from '@/lib/permissions'
import Link from 'next/link'
import EmptyState from '@/components/ui/EmptyState'
import QuoteStavBadge from '@/components/QuoteStavBadge'
import { cn } from '@/lib/cn'
import { formatDate, formatCislo } from '@/lib/format'
import { NABIDKA_VISI_PO_DNECH, visiOdeslanaHranice } from '@/lib/quoteStav'
import NabidkaStavAkce from './NabidkaStavAkce'

const FILTRY = [
  { id: 'vse', label: 'Vše' },
  { id: 'visi', label: 'Visí odeslané' },
  { id: 'rozpracovane', label: 'Rozpracované', stav: 'ROZPRACOVANA' },
  { id: 'odeslane', label: 'Odeslané', stav: 'ODESLANA' },
  { id: 'akceptovane', label: 'Akceptované', stav: 'AKCEPTOVANA' },
  { id: 'odmitnute', label: 'Odmítnuté', stav: 'ODMITNUTA' },
] as const satisfies readonly { id: string; label: string; stav?: QuoteStav }[]
type FiltrId = (typeof FILTRY)[number]['id']

export default async function QuotesPage({ searchParams }: { searchParams: { filtr?: string } }) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const dealScope = dealScopeWhere(getPerms(session!.user), session!.user.id)
  if (dealScope === null) redirect('/dashboard')

  const filtr: FiltrId = FILTRY.some(f => f.id === searchParams.filtr) ? searchParams.filtr as FiltrId : 'vse'
  const visi = filtr === 'visi'

  // „Visí“ = odeslaná déle než NABIDKA_VISI_PO_DNECH a OP je pořád otevřený (procesní mapa 4.1)
  const visiWhere: Prisma.QuoteWhereInput = {
    orgId,
    stav: 'ODESLANA',
    odeslanoAt: { lt: visiOdeslanaHranice() },
    deal: { ...dealScope, stav: { notIn: ['USPECH', 'PAS', 'ZNEPLATNENO'] } },
  }
  const stavFiltru = FILTRY.find(f => f.id === filtr && 'stav' in f)
  const where: Prisma.QuoteWhereInput = visi
    ? visiWhere
    : { orgId, deal: dealScope, ...(stavFiltru && 'stav' in stavFiltru ? { stav: stavFiltru.stav } : {}) }

  const [quotes, poStavech, pocetVisi] = await Promise.all([
    prisma.quote.findMany({
      where,
      include: {
        deal: {
          include: {
            client: { select: { jmeno: true, prijmeni: true, telefon: true } },
            user: { select: { jmeno: true } },
            activities: { where: { datum: { lte: new Date() } }, orderBy: { datum: 'desc' }, take: 1, select: { datum: true } },
          },
        },
        items: true,
      },
      orderBy: visi ? { odeslanoAt: 'asc' } : { vytvoreno: 'desc' },
    }),
    prisma.quote.groupBy({ by: ['stav'], where: { orgId, deal: dealScope }, _count: true }),
    prisma.quote.count({ where: visiWhere }),
  ])

  const pocty: Record<string, number> = { visi: pocetVisi, vse: poStavech.reduce((s, g) => s + g._count, 0) }
  for (const f of FILTRY) if ('stav' in f) pocty[f.id] = poStavech.find(g => g.stav === f.stav)?._count ?? 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cenové nabídky</h1>
        <div className="flex items-center gap-3 ml-auto">
          <p className="text-sm text-gray-500 dark:text-slate-400">{quotes.length} nabídek</p>
          <Link
            href="/cenovka"
            className="border border-green-400 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 font-medium px-4 py-2 rounded-lg text-sm transition-colors"
          >
            ⚡ Rychlá cenovka
          </Link>
        </div>
      </div>

      <nav className="flex gap-1.5 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0" aria-label="Filtr nabídek">
        {FILTRY.map(f => (
          <Link
            key={f.id}
            href={f.id === 'vse' ? '/quotes' : `/quotes?filtr=${f.id}`}
            aria-current={filtr === f.id ? 'page' : undefined}
            className={cn(
              'flex items-center gap-1.5 whitespace-nowrap px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors',
              filtr === f.id
                ? 'bg-primary text-white border-primary'
                : 'bg-white dark:bg-slate-800 text-gray-700 dark:text-slate-300 border-gray-300 dark:border-slate-600 hover:border-gray-400 dark:hover:border-slate-500',
            )}
          >
            {f.label}
            <span className={cn(
              'text-xs rounded-full px-1.5',
              filtr === f.id ? 'bg-white/20' : f.id === 'visi' && pocty.visi > 0 ? 'bg-amber-500/15 text-amber-700 dark:text-amber-300' : 'text-gray-400 dark:text-slate-500',
            )}>
              {pocty[f.id] ?? 0}
            </span>
          </Link>
        ))}
      </nav>

      {visi && (
        <p className="text-sm text-gray-500 dark:text-slate-400 -mt-3">
          Nabídky odeslané před víc než {NABIDKA_VISI_PO_DNECH} dny, na které klient zatím nereagoval. Nejstarší nahoře, ozvěte se a výsledek označte.
        </p>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
        {quotes.length === 0 ? (
          visi ? (
            <EmptyState
              title="Nic nevisí"
              description={`Žádná odeslaná nabídka nečeká na reakci klienta déle než ${NABIDKA_VISI_PO_DNECH} dní.`}
            />
          ) : (
            <EmptyState
              title="Zatím žádné cenové nabídky"
              description="Nabídka se vytváří v detailu obchodního případu na záložce Nabídky — ručně, z produktů, nebo jedním klikem ze vzorové nabídky."
              actionLabel="Přejít na obchodní případy"
              actionHref="/deals"
            />
          )
        ) : (<>
        {/* Mobil: karty */}
        <ul className="md:hidden divide-y divide-gray-100 dark:divide-slate-700">
          {quotes.map(q => {
            const celkem = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
            return (
              <li key={q.id} className="px-4 py-3">
                <Link href={`/deals/${q.dealId}?tab=nabidky`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-900 dark:text-white min-w-0 truncate">{q.nazev}</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white whitespace-nowrap">{celkem > 0 ? formatCislo(celkem) + ' Kč' : '—'}</p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-slate-300 truncate">
                    {q.deal.kod && <span className="font-mono text-xs mr-1.5">{q.deal.kod}</span>}
                    {q.deal.client.jmeno} {q.deal.client.prijmeni}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                    <QuoteStavBadge stav={q.stav} odeslanoAt={q.odeslanoAt} />
                    {formatDate(q.vytvoreno)} · {q.items.length} položek
                    {q.aktivni && <span className="text-green-700 dark:text-green-400 font-medium">· Aktivní</span>}
                  </p>
                </Link>
                {visi && (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {q.deal.client.telefon && <a href={`tel:${q.deal.client.telefon}`} className="text-primary dark:text-primary-light font-medium mr-2">{q.deal.client.telefon}</a>}
                      {q.deal.user?.jmeno ?? 'bez vlastníka'}
                    </p>
                    <NabidkaStavAkce quoteId={q.id} telefon={q.deal.client.telefon} />
                  </div>
                )}
              </li>
            )
          })}
        </ul>
        <table className="w-full hidden md:table">
          <thead className="bg-gray-50 dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
            <tr>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Název nabídky</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Obchodní případ</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Klient</th>
              {visi && <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Vlastník</th>}
              <th className="text-right text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Celková cena</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">Stav</th>
              <th className="text-left text-xs font-semibold text-gray-500 dark:text-slate-400 uppercase px-6 py-3">{visi ? 'Poslední kontakt' : 'Datum'}</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-700">
            {quotes.map((q) => {
              const celkem = q.items.reduce((s, i) => s + Number(i.mnozstvi) * Number(i.cenaZaKus), 0)
              const posledni = q.deal.activities[0]?.datum
              return (
                <tr key={q.id} className="hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900 dark:text-white flex items-center gap-1.5">
                      {q.aktivni && <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" title="Aktivní nabídka OP" />}
                      {q.nazev}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">{q.kod ? `${q.kod} · ` : ''}{q.items.length} položek</p>
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
                    {visi && q.deal.client.telefon && (
                      <a href={`tel:${q.deal.client.telefon}`} className="block text-xs text-primary dark:text-primary-light font-medium">{q.deal.client.telefon}</a>
                    )}
                  </td>
                  {visi && <td className="px-6 py-4 text-sm text-gray-600 dark:text-slate-400">{q.deal.user?.jmeno ?? '—'}</td>}
                  <td className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                    {celkem > 0 ? formatCislo(celkem) + ' Kč' : '—'}
                  </td>
                  <td className="px-6 py-4">
                    <QuoteStavBadge stav={q.stav} odeslanoAt={q.odeslanoAt} />
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-slate-400">
                    {visi ? (posledni ? formatDate(posledni) : '—') : formatDate(q.vytvoreno)}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {visi ? (
                      <NabidkaStavAkce quoteId={q.id} telefon={q.deal.client.telefon} />
                    ) : (
                      <Link
                        href={`/deals/${q.dealId}?tab=nabidky`}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                      >
                        Detail →
                      </Link>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </>)}
      </div>
    </div>
  )
}
