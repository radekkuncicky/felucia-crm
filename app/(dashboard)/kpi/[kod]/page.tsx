import { getServerSession } from 'next-auth'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { cn } from '@/lib/cn'
import { kpiPristup, kpiDetail, formatKpi, formatCil, mesicLabel } from '@/lib/kpi'
import { isKpiKod } from '@/lib/kpi/registry'
import { isMesicKlic, HISTORIE_OD } from '@/lib/kpi/obdobi'
import { PageHeader } from '@/components/ui/PageHeader'
import { SemaforTecka, SEMAFOR_LABEL } from '@/components/kpi/KpiDlazdice'

export const metadata = { title: 'KPI vedení' }

export default async function KpiDetailPage({ params, searchParams }: {
  params: { kod: string }
  searchParams: { mesic?: string }
}) {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  if (!(await kpiPristup(orgId, getPerms(session!.user)))) redirect('/dashboard')
  if (!isKpiKod(params.kod)) notFound()

  const mesic = isMesicKlic(searchParams.mesic) && searchParams.mesic >= HISTORIE_OD ? searchParams.mesic : undefined
  const k = await kpiDetail(orgId, params.kod, mesic)
  const max = Math.max(...k.trend.map(b => Math.abs(b.hodnota ?? 0)), 0)

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      <PageHeader
        back={{ href: '/kpi', label: 'KPI vedení' }}
        title={`${k.def.cislo}. ${k.def.nazev}`}
        description={k.def.popis}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">{mesicLabel(k.mesic)}</p>
          <p className="text-2xl font-bold text-fg mt-1">{formatKpi(k.hodnota, k.jednotka)}</p>
          {k.hodnotaDetail && <p className="text-xs text-muted mt-0.5">{k.hodnotaDetail}</p>}
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Cíl</p>
          <p className="text-lg font-semibold text-fg mt-1">{formatCil(k.def, k.nastaveni.cil)}</p>
          <p className="text-xs text-muted mt-0.5 flex items-center gap-1.5"><SemaforTecka s={k.semafor} />{SEMAFOR_LABEL[k.semafor]}</p>
        </div>
        <div className="rounded-xl border border-line bg-surface p-4">
          <p className="text-xs text-muted">Aktuální měsíc (průběžně)</p>
          <p className="text-lg font-semibold text-fg mt-1">{formatKpi(k.prubezne, k.jednotka)}</p>
        </div>
      </div>

      {k.poznamka && (
        <p className="text-sm text-muted rounded-lg bg-surface-2 border border-line px-3 py-2">{k.poznamka}</p>
      )}

      {k.def.dostupne && k.trend.length > 0 && (
        <section aria-labelledby="trend" className="rounded-xl border border-line bg-surface p-4">
          <h2 id="trend" className="text-sm font-semibold text-fg mb-3">Vývoj po měsících</h2>
          <div className="flex items-end gap-1.5 h-36 overflow-x-auto">
            {k.trend.map(b => {
              const vybrany = b.klic === k.zaznamyMesic
              return (
                <Link
                  key={b.klic}
                  href={`/kpi/${k.def.kod}?mesic=${b.klic}`}
                  scroll={false}
                  className="flex-1 min-w-[36px] h-full flex flex-col justify-end items-center gap-1 group"
                  title={`${mesicLabel(b.klic)}: ${formatKpi(b.hodnota, k.jednotka)}${b.detail ? ` (${b.detail})` : ''}`}
                >
                  <span className="text-[10px] text-muted">{formatKpi(b.hodnota, k.jednotka)}</span>
                  <span
                    className={cn('w-full rounded-t', vybrany ? 'bg-primary' : 'bg-slate-300 dark:bg-slate-600 group-hover:bg-slate-400')}
                    style={{ height: `${max ? Math.max(2, (Math.abs(b.hodnota ?? 0) / max) * 100) : 2}%` }}
                  />
                  <span className={cn('text-[10px]', vybrany ? 'text-fg font-semibold' : 'text-muted')}>{mesicLabel(b.klic, true)}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {k.def.dostupne ? (
        <section aria-labelledby="zaznamy" className="rounded-xl border border-line bg-surface">
          <div className="px-4 py-3 border-b border-line">
            <h2 id="zaznamy" className="text-sm font-semibold text-fg">{k.zaznamyNadpis}</h2>
            <p className="text-xs text-muted">{mesicLabel(k.zaznamyMesic)} · {k.zaznamy.length} záznamů</p>
          </div>
          {k.zaznamy.length ? (
            <ul className="divide-y divide-line">
              {k.zaznamy.map(z => (
                <li key={z.id}>
                  <Link href={z.href} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-surface-2 min-h-[44px]">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-fg truncate">{z.titulek}</span>
                      {z.popis && <span className="block text-xs text-muted truncate">{z.popis}</span>}
                    </span>
                    {z.hodnota && <span className="text-sm font-semibold text-fg whitespace-nowrap">{z.hodnota}</span>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-6 text-sm text-muted text-center">V tomto měsíci nic.</p>
          )}
        </section>
      ) : (
        <p className="text-sm text-muted">Toto KPI patří do fáze {k.def.faze}. {k.def.chybi}</p>
      )}
    </div>
  )
}
