import Link from 'next/link'
import { kpiPrehled } from '@/lib/kpi'
import { KpiDlazdice } from '@/components/kpi/KpiDlazdice'

/** Horní řada KPI vedení na Nástěnce (jen modulKpi + oprávnění kpi — hlídá volající). */
export default async function KpiRada({ orgId }: { orgId: string }) {
  const kpi = await kpiPrehled(orgId, { jenAktivni: true })
  if (!kpi.length) return null
  return (
    <section aria-labelledby="kpi-rada">
      <div className="flex items-baseline justify-between mb-2">
        <h2 id="kpi-rada" className="text-sm font-semibold text-fg">KPI vedení</h2>
        <Link href="/kpi" className="text-xs text-muted hover:text-fg">Vše a nastavení →</Link>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1 snap-x sm:grid sm:grid-cols-3 lg:grid-cols-5 sm:overflow-visible">
        {kpi.map(k => (
          <KpiDlazdice key={k.def.kod} k={k} className="min-w-[200px] snap-start sm:min-w-0" />
        ))}
      </div>
    </section>
  )
}

export function KpiRadaSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-hidden>
      {[0, 1, 2].map(i => <div key={i} className="h-[88px] rounded-xl border border-line bg-surface animate-pulse" />)}
    </div>
  )
}
