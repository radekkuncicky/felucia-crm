import { getServerSession } from 'next-auth'
import { redirect } from 'next/navigation'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { kpiPristup, kpiPrehled } from '@/lib/kpi'
import { PageHeader } from '@/components/ui/PageHeader'
import { ButtonLink } from '@/components/ui/Button'
import { KpiDlazdice } from '@/components/kpi/KpiDlazdice'

export const metadata = { title: 'KPI vedení' }

export default async function KpiPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  if (!(await kpiPristup(orgId, getPerms(session!.user)))) redirect('/dashboard')

  const kpi = await kpiPrehled(orgId)
  const aktivni = kpi.filter(k => k.nastaveni.aktivni)
  const ostatni = kpi.filter(k => !k.nastaveni.aktivni)

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6">
      <PageHeader
        title="KPI vedení"
        description="Hodnoty za poslední uzavřený měsíc proti cíli. Klikněte na KPI pro záznamy, které ho kazí."
        actions={<ButtonLink href="/kpi/nastaveni" variant="secondary" size="sm">Cíle a zobrazení</ButtonLink>}
      />
      <section className="space-y-2">
        <h2 className="text-sm font-semibold text-fg">Na Nástěnce</h2>
        {aktivni.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {aktivni.map(k => <KpiDlazdice key={k.def.kod} k={k} />)}
          </div>
        ) : (
          <p className="text-sm text-muted">Žádné KPI není zapnuté. Zapněte je v nastavení.</p>
        )}
      </section>
      {ostatni.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-fg">Skryté nebo zatím bez dat</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {ostatni.map(k => <KpiDlazdice key={k.def.kod} k={k} className="opacity-80" />)}
          </div>
        </section>
      )}
    </div>
  )
}
