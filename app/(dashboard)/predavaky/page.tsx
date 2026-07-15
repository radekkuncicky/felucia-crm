import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDate } from '@/lib/format'

const STAV_LABELS: Record<string, string> = {
  ROZPRACOVAN: 'Rozpracován',
  PODPISAN: 'Podepsán',
  SCHVALEN: 'Schválen',
  ODMITNUTO: 'Odmítnuto',
}

const STAV_COLORS: Record<string, string> = {
  ROZPRACOVAN: 'bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-slate-400',
  PODPISAN: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  SCHVALEN: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  ODMITNUTO: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300',
}

export default async function PredavakyPage() {
  const session = await getServerSession(authOptions)
  if (!session) notFound()

  const orgId = session.user.orgId
  const isTechnik = session.user.role === 'TECHNIK'

  const predavaky = await prisma.predavak.findMany({
    where: {
      orgId,
      ...(isTechnik ? { technikId: session.user.id } : {}),
    },
    include: {
      zakazka: {
        select: {
          id: true,
          cislo: true,
          nazev: true,
          klient: { select: { jmeno: true, prijmeni: true } },
        },
      },
      technik: { select: { jmeno: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  })

  return (
    <div className="space-y-5 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Předávací protokoly</h1>
        <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
          {isTechnik ? 'Vaše protokoly' : 'Všechny protokoly'}
        </p>
      </div>

      {predavaky.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-12 text-center">
          <p className="text-gray-400 dark:text-slate-500">Žádné protokoly</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-gray-100 dark:divide-slate-700">
            {predavaky.map(p => (
              <Link
                key={p.id}
                href={`/zakazky/${p.zakazka.id}/predavaky/${p.id}`}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-sm font-bold text-green-600 dark:text-green-400">{p.cislo}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${STAV_COLORS[p.stav]}`}>
                      {STAV_LABELS[p.stav]}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                    {p.zakazka.cislo} · {p.zakazka.nazev}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-slate-500 mt-0.5">
                    Klient: {p.zakazka.klient.jmeno} {p.zakazka.klient.prijmeni}
                    {!isTechnik && ` · Technik: ${p.technik.jmeno}`}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-400 dark:text-slate-500">
                    {formatDate(p.updatedAt)}
                  </p>
                  {p.podpisano && (
                    <p className="text-xs text-primary dark:text-primary-light mt-0.5">
                      Podepsán {formatDate(p.podpisano)}
                    </p>
                  )}
                </div>
                <svg className="w-4 h-4 text-gray-300 dark:text-slate-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
