import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getPerms } from '@/lib/permissions'
import { orgPrisma } from '@/lib/orgPrisma'
import { KpiBezPristupu } from '@/components/kpi/KpiBezPristupu'
import { kpiPristup, nactiNastaveni } from '@/lib/kpi'
import { kpiDef } from '@/lib/kpi/registry'
import { PageHeader } from '@/components/ui/PageHeader'
import KpiNastaveniClient from './KpiNastaveniClient'

export const metadata = { title: 'Nastavení KPI' }

export default async function KpiNastaveniPage() {
  const session = await getServerSession(authOptions)
  const orgId = session!.user.orgId
  const perms = getPerms(session!.user)
  if (!(await kpiPristup(orgId, perms))) return <KpiBezPristupu bezOpravneni={!perms.kpi} spravaUzivatelu={perms.spravaUzivatelu} />

  const nastaveni = await nactiNastaveni(orgPrisma(orgId), orgId)
  const polozky = nastaveni.map(n => {
    const def = kpiDef(n.kod)!
    return { ...n, cislo: def.cislo, nazev: def.nazev, jednotka: def.kod === 'MATERIAL_BEZ_ZAKAZKY' || def.kod === 'ZALOHY' ? '%' : def.jednotka, smer: def.smer, dostupne: def.dostupne, cekaNa: def.cekaNa }
  })

  return (
    <div className="max-w-3xl mx-auto w-full space-y-6">
      <PageHeader
        back={{ href: '/kpi', label: 'KPI vedení' }}
        title="Cíle a zobrazení KPI"
        description="Zapnutá KPI jsou v horní řadě Nástěnky v tomto pořadí. Oranžová = do 10 % od cíle."
      />
      <KpiNastaveniClient polozky={polozky} />
    </div>
  )
}
